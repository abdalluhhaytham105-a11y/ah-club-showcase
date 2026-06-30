const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

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
const upload = multer({
  storage: storage,
  limits: {
    fieldSize: 10 * 1024 * 1024, // زيادة الحد الأقصى للنصوص إلى 10 ميجا لدعم ترميز Base64 للصور والملفات
    fileSize: 10 * 1024 * 1024
  }
});
const archiveUpload = upload.fields([
  { name: 'projectImage', maxCount: 1 },
  { name: 'projectFile', maxCount: 1 }
]);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// Middlewares للتحقق وفصل الصلاحيات (Authorization)
// ----------------------------------------------------

async function verifyAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'من فضلك سجل دخولك أولاً' });
  }
  try {
    const data = await db.readDb();
    const user = data.users.find(u => u.id === userId);
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
    const data = await db.readDb();
    let user = data.users.find(u => u.id === userId);
    if (!user) {
      // مرونة إضافية لمنع التعليق في حال عدم مزامنة السيرفر لملف التسجيل
      if (userId.startsWith('user-') || userId.startsWith('admin-')) {
        user = {
          id: userId,
          role: userId.startsWith('admin-') ? 'admin' : 'student',
          name: 'طالب مسجل'
        };
      } else {
        return res.status(401).json({ error: 'حسابك غير موجود بالخادم' });
      }
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
    const data = await db.readDb();
    const userExists = data.users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }

    const newUser = {
      id: 'user-' + Date.now(),
      name,
      email,
      phone,
      university,
      major,
      password,
      role: 'student'
    };

    data.users.push(newUser);
    await db.writeDb(data);

    // إرسال بيانات المستخدم بدون الباسورد
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل حساب جديد' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'من فضلك ادخل البريد الإلكتروني وكلمة المرور' });
  }

  try {
    const data = await db.readDb();
    const user = data.users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// ----------------------------------------------------
// 2. إدارة مشاريع الأرشيف المعروضة للكل
// ----------------------------------------------------

app.get('/api/projects', async (req, res) => {
  try {
    const data = await db.readDb();
    res.json(data.projects);
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
  if (req.body.projectImageBase64) {
    imageUrl = req.body.projectImageBase64;
  } else if (req.files && req.files['projectImage'] && req.files['projectImage'][0]) {
    imageUrl = '/uploads/' + req.files['projectImage'][0].filename;
  }

  let fileUrl = link || '#';
  if (req.body.projectFileBase64) {
    fileUrl = req.body.projectFileBase64;
  } else if (req.files && req.files['projectFile'] && req.files['projectFile'][0]) {
    fileUrl = '/uploads/' + req.files['projectFile'][0].filename;
  }

  try {
    const data = await db.readDb();
    const newProject = {
      id: 'proj-' + Date.now(),
      title,
      category,
      college,
      description,
      techUsed,
      image: imageUrl,
      link: fileUrl
    };

    data.projects.unshift(newProject);
    await db.writeDb(data);
    res.status(201).json(newProject);
  } catch (err) {
    console.error('Error adding project to archive:', err);
    res.status(500).json({ error: 'فشل إضافة المشروع للأرشيف' });
  }
});

app.delete('/api/projects/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const data = await db.readDb();
    const index = data.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    data.projects.splice(index, 1);
    await db.writeDb(data);
    res.json({ message: 'تم حذف المشروع بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف المشروع' });
  }
});

app.put('/api/projects/:id', verifyAdmin, archiveUpload, async (req, res) => {
  const { id } = req.params;
  const { title, category, college, description, techUsed, link } = req.body;

  try {
    const data = await db.readDb();
    const index = data.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }

    const project = data.projects[index];
    if (title) project.title = title;
    if (category) project.category = category;
    if (college) project.college = college;
    if (description) project.description = description;
    if (techUsed) project.techUsed = techUsed;

    if (req.body.projectImageBase64) {
      project.image = req.body.projectImageBase64;
    } else if (req.files && req.files['projectImage'] && req.files['projectImage'][0]) {
      project.image = '/uploads/' + req.files['projectImage'][0].filename;
    }

    if (req.body.projectFileBase64) {
      project.link = req.body.projectFileBase64;
    } else if (req.files && req.files['projectFile'] && req.files['projectFile'][0]) {
      project.link = '/uploads/' + req.files['projectFile'][0].filename;
    } else if (link !== undefined) {
      project.link = link;
    }

    await db.writeDb(data);
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
    const data = await db.readDb();
    res.json(data.categories || []);
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
    const data = await db.readDb();
    const id = 'cat-' + Date.now();
    const newCategory = { id, label };
    if (!data.categories) data.categories = [];
    data.categories.push(newCategory);
    await db.writeDb(data);
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة القسم' });
  }
});

app.delete('/api/categories/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const data = await db.readDb();
    if (!data.categories) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    const index = data.categories.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    data.categories.splice(index, 1);
    await db.writeDb(data);
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
    const data = await db.readDb();
    if (req.user.role === 'student') {
      const studentRequests = data.requests.filter(r => r.studentId === req.user.id);
      return res.json(studentRequests);
    }

    if (studentId) {
      const studentRequests = data.requests.filter(r => r.studentId === studentId);
      return res.json(studentRequests);
    }

    res.json(data.requests);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الطلبات الجارية' });
  }
});

app.post('/api/requests', verifyStudent, upload.single('attachment'), async (req, res) => {
  const { 
    studentId, 
    studentName, 
    studentPhone,
    title, 
    college, 
    university, 
    description, 
    techNeeded, 
    deadline,
    deliveryFormat,
    slideCount,
    teamSize,
    hasData,
    estimatedPrice
  } = req.body;
  
  if (!studentId || !studentName || !title || !college || !university || !description || !deadline) {
    return res.status(400).json({ error: 'من فضلك املأ جميع بيانات الاستمارة الأساسية' });
  }

  if (req.user.role === 'student' && studentId !== req.user.id) {
    return res.status(403).json({ error: 'غير مصرح لك بإنشاء طلب لحساب آخر' });
  }

  try {
    const data = await db.readDb();
    const newRequest = {
      id: 'req-' + Date.now(),
      studentId,
      studentName,
      studentPhone: studentPhone || req.user.phone || '',
      title,
      college,
      university,
      description,
      techNeeded: techNeeded || 'غير محدد',
      deadline,
      deliveryFormat: deliveryFormat || 'word',
      slideCount: slideCount ? parseInt(slideCount) : 0,
      teamSize: teamSize ? parseInt(teamSize) : 1,
      hasData: hasData === 'yes' || hasData === 'true' || hasData === true,
      estimatedPrice: estimatedPrice ? parseFloat(estimatedPrice) : 0,
      status: 'pending',
      price: 0,
      paymentMethod: '',
      transactionId: '',
      attachmentFile: req.file ? '/uploads/' + req.file.filename : '',
      paymentReceipt: '',
      deliveryFile: '',
      createdAt: new Date().toISOString()
    };

    data.requests.push(newRequest);
    await db.writeDb(data);
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تقديم طلبك' });
  }
});

app.put('/api/requests/:id/status', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (status) data.requests[requestIndex].status = status;
    if (price !== undefined) data.requests[requestIndex].price = Number(price);

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
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
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.user.role === 'student' && data.requests[requestIndex].studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتسديد دفعات لطلب لا تملكه' });
    }

    data.requests[requestIndex].paymentMethod = paymentMethod;
    data.requests[requestIndex].transactionId = transactionId;
    data.requests[requestIndex].status = 'ready_payment_verify';

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تسجيل بيانات الدفع' });
  }
});

app.put('/api/requests/:id/confirm-payment', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    data.requests[requestIndex].status = 'paid';
    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تأكيد عملية الدفع' });
  }
});

app.put('/api/requests/:id/cancel', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim() === '') {
    return res.status(400).json({ error: 'الرجاء إدخال سبب الإلغاء للطلاب' });
  }

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    data.requests[requestIndex].status = 'cancelled';
    data.requests[requestIndex].cancellationReason = reason;

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل إلغاء الطلب' });
  }
});

// رفع لقطة شاشة إثبات الدفع من الطالب
app.put('/api/requests/:id/payment-receipt', verifyStudent, upload.single('receipt'), async (req, res) => {
  const { id } = req.params;

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (data.requests[requestIndex].studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الطلب' });
    }

    if (req.file) {
      data.requests[requestIndex].paymentReceipt = '/uploads/' + req.file.filename;
    }
    
    // تحويل الحالة إلى انتظار التحقق من الدفع من قبل الأدمن
    data.requests[requestIndex].status = 'ready_payment_verify';

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل رفع إثبات الدفع' });
  }
});

// تأكيد البدء الفوري للطلاب أصحاب الخصم الكلي 100% (السعر 0)
app.put('/api/requests/:id/confirm-free', verifyStudent, async (req, res) => {
  const { id } = req.params;

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (data.requests[requestIndex].studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل هذا الطلب' });
    }

    if (data.requests[requestIndex].price > 0) {
      return res.status(400).json({ error: 'هذا الطلب يتطلب دفع مالي ولا يمكن تأكيده مجاناً' });
    }

    data.requests[requestIndex].status = 'paid';

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تأكيد الطلب المجاني' });
  }
});

app.put('/api/requests/:id/deliver', verifyAdmin, upload.single('delivery'), async (req, res) => {
  const { id } = req.params;
  const { deliveryLink } = req.body;

  try {
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.file) {
      data.requests[requestIndex].deliveryFile = '/uploads/' + req.file.filename;
    } else if (deliveryLink) {
      data.requests[requestIndex].deliveryFile = deliveryLink;
    } else {
      return res.status(400).json({ error: 'الرجاء رفع ملف أو إدخال رابط للتسليم' });
    }

    data.requests[requestIndex].status = 'completed';
    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
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
    const data = await db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (req.user.role === 'student' && data.requests[requestIndex].studentId !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتقييم طلب لا تملكه' });
    }

    if (data.requests[requestIndex].status !== 'completed') {
      return res.status(400).json({ error: 'يمكنك تقييم الطلب بعد تسليمه وإنجازه فقط' });
    }

    data.requests[requestIndex].rating = Number(rating);
    data.requests[requestIndex].ratingComment = ratingComment || '';

    await db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل إرسال تقييمك' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const data = await db.readDb();
    
    // التقييمات من طلبات الطلاب المكتملة
    const completedWithRating = data.requests.filter(r => r.status === 'completed' && r.rating);
    // التقييمات من زوار المعرض
    const projectRatings = data.projectRatings || [];
    
    let allRatings = [];
    completedWithRating.forEach(r => allRatings.push(r.rating));
    projectRatings.forEach(r => allRatings.push(r.rating));

    let satisfactionRate = 98;
    if (allRatings.length > 0) {
      const totalRating = allRatings.reduce((sum, r) => sum + r, 0);
      const avgRating = totalRating / allRatings.length;
      satisfactionRate = Math.round((avgRating / 5) * 100);
    }

    const completedCount = 300 + data.requests.filter(r => r.status === 'completed').length;

    res.json({
      completedCount,
      satisfactionRate: 99
    });
  } catch (err) {
    res.json({ completedCount: 300, satisfactionRate: 99 });
  }
});

// تطبيق كود الخصم للطالب
app.post('/api/promos/apply', async (req, res) => {
  const { code } = req.body;
  const userId = req.headers['x-user-id'];

  if (!code) {
    return res.status(400).json({ error: 'الرجاء إدخال كود الخصم' });
  }

  try {
    const data = await db.readDb();
    const now = new Date();
    
    // البحث عن إعلان خصم يحتوي على نفس الكود ويكون نشط وغير منتهي الصلاحية
    const promo = (data.announcements || []).find(ann => {
      if (ann.type !== 'discount' || !ann.discountCode) return false;
      if (ann.discountCode.trim().toUpperCase() !== code.trim().toUpperCase()) return false;
      if (!ann.active) return false;
      
      const created = new Date(ann.createdAt);
      const expiry = new Date(created.getTime() + Number(ann.durationDays) * 24 * 60 * 60 * 1000);
      return now <= expiry;
    });

    if (!promo) {
      return res.status(400).json({ error: 'كود الخصم غير صحيح أو انتهت صلاحيته' });
    }

    // إذا كان الطالب مسجلاً، نقوم بحفظ الخصم في حسابه مباشرة لتطبيقه تلقائياً
    let userMessage = 'تم التحقق من الكود بنجاح!';
    if (userId) {
      const userIndex = data.users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        data.users[userIndex].discountPercent = promo.discountPercent;
        data.users[userIndex].specialOffer = `خصم ${promo.discountPercent}% باستخدام كود ${promo.discountCode}`;
        await db.writeDb(data);
        userMessage = `تم تطبيق خصم بقيمة ${promo.discountPercent}% على حسابك تلقائياً!`;
      }
    }

    res.json({
      message: userMessage,
      code: promo.discountCode,
      percent: promo.discountPercent
    });
  } catch (err) {
    res.status(500).json({ error: 'فشل تطبيق كود الخصم' });
  }
});

// تسجيل تقييم لمشروع في المعرض
app.post('/api/projects/:id/rate', async (req, res) => {
  const { id } = req.params;
  const { rating, ratingComment, visitorName, visitorEmail } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'الرجاء إدخال تقييم صحيح بين 1 و 5 نجوم' });
  }

  try {
    const data = await db.readDb();
    const project = data.projects.find(p => p.id === id);
    if (!project) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }

    if (!data.projectRatings) data.projectRatings = [];

    const newRating = {
      id: 'rate-' + Date.now(),
      projectId: id,
      projectName: project.title,
      rating: Number(rating),
      comment: ratingComment || '',
      visitorName: visitorName || 'زائر مجهول',
      visitorEmail: visitorEmail || 'غير متوفر',
      createdAt: new Date().toISOString()
    };

    data.projectRatings.unshift(newRating);
    await db.writeDb(data);
    res.status(201).json({ message: 'شكراً لتقييمك! تم تسجيل التقييم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل تسجيل تقييم المشروع' });
  }
});

// جلب جميع تقييمات المعرض (للأدمن فقط)
app.get('/api/admin/project-ratings', verifyAdmin, async (req, res) => {
  try {
    const data = await db.readDb();
    res.json(data.projectRatings || []);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب تقييمات المعرض' });
  }
});

// ----------------------------------------------------
// 4. إدارة لوحة الطلاب والمطورين المتقدمة
// ----------------------------------------------------

app.get('/api/students', verifyAdmin, async (req, res) => {
  try {
    const data = await db.readDb();
    const students = data.users.filter(u => u.role === 'student');
    
    const studentListWithStats = students.map(s => {
      const studentOrders = data.requests.filter(r => r.studentId === s.id);
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
    const data = await db.readDb();
    const user = data.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب بيانات المستخدم' });
  }
});

app.put('/api/students/:id/privileges', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { discountPercent, specialOffer } = req.body;

  try {
    const data = await db.readDb();
    const userIndex = data.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    data.users[userIndex].discountPercent = Number(discountPercent) || 0;
    data.users[userIndex].specialOffer = specialOffer || '';

    await db.writeDb(data);
    res.json(data.users[userIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل الامتيازات' });
  }
});

app.delete('/api/students/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  if (id === 'admin-id-123') {
    return res.status(400).json({ error: 'لا يمكن حذف حساب المسؤول الرئيسي' });
  }

  try {
    const data = await db.readDb();
    
    // البحث عن الطالب
    const userIndex = data.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'الطالب غير موجود' });
    }

    // حذف الطالب
    data.users.splice(userIndex, 1);

    // تنظيف طلبات الطالب المرتبطة به
    if (data.requests) {
      data.requests = data.requests.filter(r => r.studentId !== id);
    }

    await db.writeDb(data);
    res.json({ message: 'تم حذف الطالب وجميع طلباته المرتبطة بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف الطالب من قاعدة البيانات' });
  }
});

app.put('/api/students/:id/profile', verifyStudent, upload.single('avatar'), async (req, res) => {
  const { id } = req.params;
  const { name, phone, university, major, password } = req.body;

  try {
    const data = await db.readDb();
    const userIndex = data.users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    if (req.user.role === 'student' && id !== req.user.id) {
      return res.status(403).json({ error: 'غير مصرح لك بتعديل بيانات هذا الحساب' });
    }

    const user = data.users[userIndex];
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (university) user.university = university;
    if (major) user.major = major;
    if (password && password.trim() !== '') user.password = password.trim();

    if (req.file) {
      user.profileImage = '/uploads/' + req.file.filename;
    }

    await db.writeDb(data);

    const { password: _, ...userWithoutPassword } = user;
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
    const data = await db.readDb();
    const now = new Date();
    const activeAnnouncements = (data.announcements || []).filter(ann => {
      if (!ann.active) return false;
      if (ann.isPromoOnly) return false; // لا يظهر كإعلان عام منبثق
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
    const data = await db.readDb();
    const announcements = data.announcements || [];

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
  const { title, content, durationDays, order, active, type, discountCode, discountPercent, isPromoOnly } = req.body;
  if (!title || !content || !durationDays) {
    return res.status(400).json({ error: 'جميع الحقول الأساسية مطلوبة' });
  }

  try {
    const data = await db.readDb();
    if (!data.announcements) data.announcements = [];

    const newAnn = {
      id: 'ann-' + Date.now(),
      title,
      content,
      durationDays: Number(durationDays),
      order: Number(order) || 0,
      active: active !== undefined ? active : true,
      type: type || 'normal',
      discountCode: discountCode || '',
      discountPercent: Number(discountPercent) || 0,
      isPromoOnly: isPromoOnly !== undefined ? isPromoOnly : false,
      createdAt: new Date().toISOString()
    };

    data.announcements.push(newAnn);
    await db.writeDb(data);
    res.status(201).json(newAnn);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة الإعلان الجديد' });
  }
});

app.put('/api/admin/announcements/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, content, durationDays, order, active, type, discountCode, discountPercent, isPromoOnly } = req.body;

  try {
    const data = await db.readDb();
    const index = (data.announcements || []).findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'الإعلان غير موجود' });
    }

    const ann = data.announcements[index];
    if (title !== undefined) ann.title = title;
    if (content !== undefined) ann.content = content;
    if (durationDays !== undefined) ann.durationDays = Number(durationDays);
    if (order !== undefined) ann.order = Number(order);
    if (active !== undefined) ann.active = active;
    if (type !== undefined) ann.type = type;
    if (discountCode !== undefined) ann.discountCode = discountCode;
    if (discountPercent !== undefined) ann.discountPercent = Number(discountPercent);
    if (isPromoOnly !== undefined) ann.isPromoOnly = isPromoOnly;

    await db.writeDb(data);
    res.json(ann);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل الإعلان' });
  }
});

app.delete('/api/admin/announcements/:id', verifyAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const data = await db.readDb();
    const index = (data.announcements || []).findIndex(a => a.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'الإعلان غير موجود' });
    }

    data.announcements.splice(index, 1);
    await db.writeDb(data);
    res.json({ message: 'تم حذف الإعلان بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف الإعلان' });
  }
});

// معالج الأخطاء العام للملتر (Multer Error Handler) والرفع
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer upload error:', err);
    return res.status(400).json({ error: 'خطأ أثناء رفع الملف: ' + err.message });
  }
  if (err) {
    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: err.message || 'حدث خطأ داخلي في الخادم' });
  }
  next();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
