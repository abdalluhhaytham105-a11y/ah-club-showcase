const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// الاتصال بقاعدة البيانات السحابية عند تشغيل السيرفر
db.connectToMongo().catch(err => {
  console.error('Failed to establish initial MongoDB connection:', err.message);
});

// إعداد مسار الرفع للملفات مع دعم مجلد مؤقت على Vercel
let uploadDir = path.join(__dirname, 'public', 'uploads');
if (process.env.VERCEL) {
  uploadDir = '/tmp';
}

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Unable to create upload directory, falling back to OS temp dir:', e);
  uploadDir = '/tmp';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });
const archiveUpload = upload.fields([
  { name: 'projectImage', maxCount: 1 },
  { name: 'projectFile', maxCount: 1 }
]);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware لضمان الاتصال بقاعدة البيانات السحابية قبل معالجة أي طلب
async function ensureDbConnection(req, res, next) {
  try {
    await db.connectToMongo();
    next();
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({ error: 'فشل الاتصال بقاعدة البيانات السحابية: ' + err.message });
  }
}

app.use(ensureDbConnection);

// ----------------------------------------------------
// Middlewares للتحقق وفصل الصلاحيات (Authorization)
// ----------------------------------------------------

async function verifyAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'من فضلك سجل دخولك أولاً' });
  }
  try {
    const user = await db.User.findOne({ id: userId });
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'غير مصرح لك بالدخول، صلاحيات الأدمن مطلوبة' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ داخلي في الخادم أثناء التحقق من الصلاحيات' });
  }
}

async function verifyStudent(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'من فضلك سجل دخولك أولاً' });
  }
  try {
    const user = await db.User.findOne({ id: userId });
    if (!user) {
      return res.status(401).json({ error: 'حسابك غير موجود بالخادم' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'خطأ داخلي في الخادم أثناء التحقق من الصلاحيات' });
  }
}

// ----------------------------------------------------
// 1. نظام التحقق والحسابات (Authentication)
// ----------------------------------------------------

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, university, major, password } = req.body;
  if (!name || !email || !phone || !university || !major || !password) {
    return res.status(400).json({ error: 'من فضلك املأ جميع الحقول' });
  }

  try {
    const userExists = await db.User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }

    const newUser = new db.User({
      id: 'user-' + Date.now(),
      name,
      email,
      phone,
      university,
      major,
      password,
      role: 'student'
    });

    await newUser.save();

    // إرسال بيانات المستخدم بدون الباسورد
    const { password: _, ...userWithoutPassword } = newUser.toObject();
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    console.error('Registration error details:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل حساب جديد: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'من فضلك ادخل البريد الإلكتروني وكلمة المرور' });
  }

  try {
    const user = await db.User.findOne({ email, password });
    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Login error details:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول: ' + err.message });
  }
});

// ----------------------------------------------------
// 2. إدارة مشاريع الأرشيف المعروضة للكل
// ----------------------------------------------------

app.get('/api/projects', async (req, res) => {
  try {
    const projects = await db.Project.find();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب مشاريع الأرشيف' });
  }
});

app.post('/api/projects', verifyAdmin, archiveUpload, async (req, res) => {
  const { title, category, college, description, techUsed, link } = req.body;
  if (!title || !category || !college || !description || !techUsed) {
    return res.status(400).json({ error: 'الحقول الأساسية للمشروع مطلوبة' });
  }

  let imageUrl = '/logo.png';
  if (req.files && req.files['projectImage'] && req.files['projectImage'][0]) {
    imageUrl = '/uploads/' + req.files['projectImage'][0].filename;
  }

  let fileUrl = link || '#';
  if (req.files && req.files['projectFile'] && req.files['projectFile'][0]) {
    fileUrl = '/uploads/' + req.files['projectFile'][0].filename;
  }

  try {
    const newProject = new db.Project({
      id: 'proj-' + Date.now(),
      title,
      category,
      college,
      description,
      techUsed,
      image: imageUrl,
      link: fileUrl
    });

    await newProject.save();
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة المشروع للأرشيف' });
  }
});

app.delete('/api/projects/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.Project.findOneAndDelete({ id });
    if (!result) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    res.json({ message: 'تم حذف المشروع بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف المشروع' });
  }
});

app.put('/api/projects/:id', verifyAdmin, archiveUpload, async (req, res) => {
  const { id } = req.params;
  const { title, category, college, description, techUsed, link } = req.body;

  try {
    const project = await db.Project.findOne({ id });
    if (!project) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }

    if (title) project.title = title;
    if (category) project.category = category;
    if (college) project.college = college;
    if (description) project.description = description;
    if (techUsed) project.techUsed = techUsed;

    if (req.files && req.files['projectImage'] && req.files['projectImage'][0]) {
      project.image = '/uploads/' + req.files['projectImage'][0].filename;
    }

    if (req.files && req.files['projectFile'] && req.files['projectFile'][0]) {
      project.link = '/uploads/' + req.files['projectFile'][0].filename;
    } else if (link !== undefined) {
      project.link = link;
    }

    await project.save();
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل المشروع' });
  }
});

// ----------------------------------------------------
// 2.5 إدارة الأقسام والتصنيفات (Categories Management)
// ----------------------------------------------------
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الأقسام' });
  }
});

app.post('/api/categories', verifyAdmin, async (req, res) => {
  const { label } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'اسم القسم مطلوب' });
  }

  try {
    const id = 'cat-' + Date.now();
    const newCategory = new db.Category({ id, label });
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة القسم' });
  }
});

app.delete('/api/categories/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.Category.findOneAndDelete({ id });
    if (!result) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    res.json({ message: 'تم حذف القسم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف القسم' });
  }
});

// ----------------------------------------------------
// 3. إدارة طلبات الطلاب والمشاريع الجارية
// ----------------------------------------------------

app.get('/api/requests', verifyStudent, async (req, res) => {
  const { studentId } = req.query;
  
  try {
    if (req.user.role === 'student') {
      const studentRequests = await db.Request.find({ studentId: req.user.id });
      return res.json(studentRequests);
    }

    if (studentId) {
      const studentRequests = await db.Request.find({ studentId });
      return res.json(studentRequests);
    }

    const allRequests = await db.Request.find();
    res.json(allRequests);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الطلبات الجارية' });
  }
});

app.post('/api/requests', verifyStudent, upload.single('attachment'), async (req, res) => {
  const { studentId, studentName, title, category, college, description, techNeeded, deadline } = req.body;
  
  if (!studentId || !studentName || !title || !category || !college || !description || !deadline) {
    return res.status(400).json({ error: 'من فضلك املأ جميع بيانات الاستمارة الأساسية' });
  }

  if (req.user.role === 'student' && studentId !== req.user.id) {
    return res.status(403).json({ error: 'غير مصرح لك بإنشاء طلب لحساب آخر' });
  }

  try {
    const newRequest = new db.Request({
      id: 'req-' + Date.now(),
      studentId,
      studentName,
      title,
      category,
      college,
      description,
      techNeeded: techNeeded || 'غير محدد',
      deadline,
      status: 'pending',
      price: 0,
      paymentMethod: '',
      transactionId: '',
      attachmentFile: req.file ? '/uploads/' + req.file.filename : '',
      deliveryFile: ''
    });

    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تقديم طلبك' });
  }
});

app.put('/api/requests/:id/status', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  try {
    const request = await db.Request.findOne({ id });
    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (status) request.status = status;
    if (price !== undefined) request.price = Number(price);

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'فشل تحديث حالة الطلب' });
  }
});

app.put('/api/requests/:id/pay', verifyStudent, async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;

  if (!paymentMethod || !transactionId) {
    return res.status(400).json({ error: 'الرجاء إدخال وسيلة الدفع ورقم التحويل' });
  }

  try {
    const request = await db.Request.findOne({ id });
    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.user.role === 'student' && request.studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتسديد دفعات لطلب لا تملكه' });
    }

    request.paymentMethod = paymentMethod;
    request.transactionId = transactionId;
    request.status = 'ready_payment_verify';

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'فشل تسجيل بيانات الدفع' });
  }
});

app.put('/api/requests/:id/confirm-payment', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const request = await db.Request.findOne({ id });
    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    request.status = 'paid';
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'فشل تأكيد عملية الدفع' });
  }
});

app.put('/api/requests/:id/deliver', verifyAdmin, upload.single('delivery'), async (req, res) => {
  const { id } = req.params;
  const { deliveryLink } = req.body;

  try {
    const request = await db.Request.findOne({ id });
    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.file) {
      request.deliveryFile = '/uploads/' + req.file.filename;
    } else if (deliveryLink) {
      request.deliveryFile = deliveryLink;
    } else {
      return res.status(400).json({ error: 'الرجاء رفع ملف أو إدخال رابط للتسليم' });
    }

    request.status = 'completed';
    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'فشل تسليم ملفات المشروع' });
  }
});

app.put('/api/requests/:id/rate', verifyStudent, async (req, res) => {
  const { id } = req.params;
  const { rating, ratingComment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'الرجاء إدخال تقييم صحيح بين 1 و 5 نجوم' });
  }

  try {
    const request = await db.Request.findOne({ id });
    if (!request) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.user.role === 'student' && request.studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتقييم طلب لا تملكه' });
    }

    if (request.status !== 'completed') {
      return res.status(400).json({ error: 'يمكنك تقييم الطلب بعد تسليمه وإنجازه فقط' });
    }

    request.rating = Number(rating);
    request.ratingComment = ratingComment || '';

    await request.save();
    res.json(request);
  } catch (err) {
    res.status(500).json({ error: 'فشل إرسال تقييمك' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const completedWithRating = await db.Request.find({ status: 'completed', rating: { $gt: 0 } });
    let satisfactionRate = 98;

    if (completedWithRating.length > 0) {
      const totalRating = completedWithRating.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / completedWithRating.length;
      satisfactionRate = Math.round((avgRating / 5) * 100);
    }

    const completedCount = 300 + (await db.Request.countDocuments({ status: 'completed' }));

    res.json({
      completedCount,
      satisfactionRate
    });
  } catch (err) {
    res.json({ completedCount: 300, satisfactionRate: 98 });
  }
});

// ----------------------------------------------------
// 4. إدارة لوحة الطلاب والمطورين المتقدمة
// ----------------------------------------------------

app.get('/api/students', verifyAdmin, async (req, res) => {
  try {
    const students = await db.User.find({ role: 'student' });
    const allRequests = await db.Request.find();

    const studentListWithStats = students.map(s => {
      const studentOrders = allRequests.filter(r => r.studentId === s.id);
      const totalSpent = studentOrders
        .filter(r => r.status === 'completed' || r.status === 'paid')
        .reduce((sum, r) => sum + r.price, 0);

      return {
        id: s.id,
        name: s.name,
        email: s.email,
        phone: s.phone,
        university: s.university,
        major: s.major,
        discountPercent: s.discountPercent || 0,
        specialOffer: s.specialOffer || "",
        ordersCount: studentOrders.length,
        totalSpent
      };
    });

    res.json(studentListWithStats);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب قائمة الطلاب' });
  }
});

app.get('/api/users/:id', verifyStudent, async (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'student' && id !== req.user.id) {
    return res.status(403).json({ error: 'غير مصرح لك بجلب بيانات حساب آخر' });
  }

  try {
    const user = await db.User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    const { password, ...safeUser } = user.toObject();
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب بيانات المستخدم' });
  }
});

app.put('/api/students/:id/privileges', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { discountPercent, specialOffer } = req.body;

  try {
    const user = await db.User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    user.discountPercent = Number(discountPercent) || 0;
    user.specialOffer = specialOffer || '';

    await user.save();
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل الامتيازات' });
  }
});

app.put('/api/students/:id/profile', verifyStudent, upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  const { name, phone, university, major, password } = req.body;

  try {
    const user = await db.User.findOne({ id });
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (req.user.role === 'student' && id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل بيانات هذا الحساب' });
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (university) user.university = university;
    if (major) user.major = major;
    if (password && password.trim() !== '') user.password = password.trim();

    if (req.file) {
      user.profileImage = '/uploads/' + req.file.filename;
    }

    await user.save();

    const { password: _, ...userWithoutPassword } = user.toObject();
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'فشل تحديث بيانات الملف الشخصي' });
  }
});

// ----------------------------------------------------
// 5. إدارة الإعلانات والتنبيهات (Announcements API)
// ----------------------------------------------------

app.get('/api/announcements', async (req, res) => {
  try {
    const now = new Date();
    const announcements = await db.Announcement.find();
    
    const activeAnnouncements = announcements.filter(ann => {
      if (!ann.active) return false;
      const created = new Date(ann.createdAt);
      const expiry = new Date(created.getTime() + Number(ann.durationDays) * 24 * 60 * 60 * 1000);
      return now <= expiry;
    });

    activeAnnouncements.sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(activeAnnouncements);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الإعلانات' });
  }
});

app.get('/api/admin/announcements', verifyAdmin, async (req, res) => {
  try {
    const announcements = await db.Announcement.find();

    announcements.sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) return orderDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب قائمة الإعلانات للإدارة' });
  }
});

app.post('/api/admin/announcements', verifyAdmin, async (req, res) => {
  const { title, content, durationDays, order, active } = req.body;
  if (!title || !content || !durationDays) {
    return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة' });
  }

  try {
    const newAnn = new db.Announcement({
      id: 'ann-' + Date.now(),
      title,
      content,
      durationDays: Number(durationDays),
      order: Number(order) || 0,
      active: active !== undefined ? active : true
    });

    await newAnn.save();
    res.status(201).json(newAnn);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة الإعلان الجديد' });
  }
});

app.put('/api/admin/announcements/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, durationDays, order, active } = req.body;

  try {
    const ann = await db.Announcement.findOne({ id });
    if (!ann) {
      return res.status(404).json({ error: 'الإعلان غير موجود' });
    }

    if (title !== undefined) ann.title = title;
    if (content !== undefined) ann.content = content;
    if (durationDays !== undefined) ann.durationDays = Number(durationDays);
    if (order !== undefined) ann.order = Number(order);
    if (active !== undefined) ann.active = active;

    await ann.save();
    res.json(ann);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل الإعلان' });
  }
});

app.delete('/api/admin/announcements/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.Announcement.findOneAndDelete({ id });
    if (!result) {
      return res.status(404).json({ error: 'الإعلان غير موجود' });
    }
    res.json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف الإعلان' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
