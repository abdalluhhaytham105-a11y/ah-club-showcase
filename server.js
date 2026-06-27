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
const upload = multer({ storage: storage });
const archiveUpload = upload.fields([
  { name: 'projectImage', maxCount: 1 },
  { name: 'projectFile', maxCount: 1 }
]);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// Middlewares للتحقق وفصل الصلاحيات (Authorization)
// ----------------------------------------------------

function verifyAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'من فضلك سجل دخولك أولاً' });
  }
  try {
    const data = db.readDb();
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

function verifyStudent(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'من فضلك سجل دخولك أولاً' });
  }
  try {
    const data = db.readDb();
    const user = data.users.find(u => u.id === userId);
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

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, university, major, password } = req.body;
  if (!name || !email || !phone || !university || !major || !password) {
    return res.status(400).json({ error: 'من فضلك املأ جميع الحقول' });
  }

  try {
    const data = db.readDb();
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
    db.writeDb(data);

    // إرسال بيانات المستخدم بدون الباسورد
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل حساب جديد' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'من فضلك ادخل البريد الإلكتروني وكلمة المرور' });
  }

  try {
    const data = db.readDb();
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

app.get('/api/projects', (req, res) => {
  try {
    const data = db.readDb();
    res.json(data.projects);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب مشاريع الأرشيف' });
  }
});

app.post('/api/projects', verifyAdmin, archiveUpload, (req, res) => {
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
    const data = db.readDb();
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
    db.writeDb(data);
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة المشروع للأرشيف' });
  }
});

app.delete('/api/projects/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const data = db.readDb();
    const index = data.projects.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'المشروع غير موجود' });
    }
    data.projects.splice(index, 1);
    db.writeDb(data);
    res.json({ message: 'تم حذف المشروع بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف المشروع' });
  }
});

app.put('/api/projects/:id', verifyAdmin, archiveUpload, (req, res) => {
  const { id } = req.params;
  const { title, category, college, description, techUsed, link } = req.body;

  try {
    const data = db.readDb();
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

    if (req.files && req.files['projectImage'] && req.files['projectImage'][0]) {
      project.image = '/uploads/' + req.files['projectImage'][0].filename;
    }

    if (req.files && req.files['projectFile'] && req.files['projectFile'][0]) {
      project.link = '/uploads/' + req.files['projectFile'][0].filename;
    } else if (link !== undefined) {
      project.link = link;
    }

    db.writeDb(data);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل المشروع' });
  }
});

// ----------------------------------------------------
// 2.5 إدارة الأقسام والتصنيفات (Categories Management)
// ----------------------------------------------------
app.get('/api/categories', (req, res) => {
  try {
    const data = db.readDb();
    res.json(data.categories || []);
  } catch (err) {
    res.status(500).json({ error: 'فشل جلب الأقسام' });
  }
});

app.post('/api/categories', verifyAdmin, (req, res) => {
  const { label } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'اسم القسم مطلوب' });
  }

  try {
    const data = db.readDb();
    const id = 'cat-' + Date.now();
    const newCategory = { id, label };
    if (!data.categories) data.categories = [];
    data.categories.push(newCategory);
    db.writeDb(data);
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(500).json({ error: 'فشل إضافة القسم' });
  }
});

app.delete('/api/categories/:id', verifyAdmin, (req, res) => {
  const { id } = req.params;
  try {
    const data = db.readDb();
    if (!data.categories) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    const index = data.categories.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'القسم غير موجود' });
    }
    data.categories.splice(index, 1);
    db.writeDb(data);
    res.json({ message: 'تم حذف القسم بنجاح' });
  } catch (err) {
    res.status(500).json({ error: 'فشل حذف القسم' });
  }
});

// ----------------------------------------------------
// 3. إدارة طلبات الطلاب والمشاريع الجارية
// ----------------------------------------------------

app.get('/api/requests', verifyStudent, (req, res) => {
  const { studentId } = req.query;
  
  try {
    const data = db.readDb();
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

app.post('/api/requests', verifyStudent, upload.single('attachment'), (req, res) => {
  const { studentId, studentName, title, category, college, description, techNeeded, deadline } = req.body;
  
  if (!studentId || !studentName || !title || !category || !college || !description || !deadline) {
    return res.status(400).json({ error: 'من فضلك املأ جميع بيانات الاستمارة الأساسية' });
  }

  if (req.user.role === 'student' && studentId !== req.user.id) {
    return res.status(403).json({ error: 'غير مصرح لك بإنشاء طلب لحساب آخر' });
  }

  try {
    const data = db.readDb();
    const newRequest = {
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
      deliveryFile: '',
      createdAt: new Date().toISOString()
    };

    data.requests.push(newRequest);
    db.writeDb(data);
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ أثناء تقديم طلبك' });
  }
});

app.put('/api/requests/:id/status', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  try {
    const data = db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    if (status) data.requests[requestIndex].status = status;
    if (price !== undefined) data.requests[requestIndex].price = Number(price);

    db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تحديث حالة الطلب' });
  }
});

app.put('/api/requests/:id/pay', verifyStudent, (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;

  if (!paymentMethod || !transactionId) {
    return res.status(400).json({ error: 'الرجاء إدخال وسيلة الدفع ورقم التحويل' });
  }

  try {
    const data = db.readDb();
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

    db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تسجيل بيانات الدفع' });
  }
});

app.put('/api/requests/:id/confirm-payment', verifyAdmin, (req, res) => {
  const { id } = req.params;

  try {
    const data = db.readDb();
    const requestIndex = data.requests.findIndex(r => r.id === id);
    if (requestIndex === -1) {
      return res.status(404).json({ error: 'الطلب غير موجود' });
    }

    data.requests[requestIndex].status = 'paid';
    db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تأكيد عملية الدفع' });
  }
});

app.put('/api/requests/:id/deliver', verifyAdmin, upload.single('delivery'), (req, res) => {
  const { id } = req.params;
  const { deliveryLink } = req.body;

  try {
    const data = db.readDb();
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
    db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تسليم ملفات المشروع' });
  }
});

app.put('/api/requests/:id/rate', verifyStudent, (req, res) => {
  const { id } = req.params;
  const { rating, ratingComment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'الرجاء إدخال تقييم صحيح بين 1 و 5 نجوم' });
  }

  try {
    const data = db.readDb();
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

    db.writeDb(data);
    res.json(data.requests[requestIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل إرسال تقييمك' });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const data = db.readDb();
    const completedWithRating = data.requests.filter(r => r.status === 'completed' && r.rating);
    let satisfactionRate = 98;

    if (completedWithRating.length > 0) {
      const totalRating = completedWithRating.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / completedWithRating.length;
      satisfactionRate = Math.round((avgRating / 5) * 100);
    }

    const completedCount = 300 + data.requests.filter(r => r.status === 'completed').length;

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

app.get('/api/students', verifyAdmin, (req, res) => {
  try {
    const data = db.readDb();
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

app.get('/api/users/:id', verifyStudent, (req, res) => {
  const { id } = req.params;
  
  if (req.user.role === 'student' && id !== req.user.id) {
    return res.status(403).json({ error: 'غير مصرح لك بجلب بيانات حساب آخر' });
  }

  try {
    const data = db.readDb();
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

app.put('/api/students/:id/privileges', verifyAdmin, (req, res) => {
  const { id } = req.params;
  const { discountPercent, specialOffer } = req.body;

  try {
    const data = db.readDb();
    const userIndex = data.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    data.users[userIndex].discountPercent = Number(discountPercent) || 0;
    data.users[userIndex].specialOffer = specialOffer || '';

    db.writeDb(data);
    res.json(data.users[userIndex]);
  } catch (err) {
    res.status(500).json({ error: 'فشل تعديل الامتيازات' });
  }
});

app.put('/api/students/:id/profile', verifyStudent, upload.single('avatar'), (req, res) => {
  const { id } = req.params;
  const { name, phone, university, major, password } = req.body;

  try {
    const data = db.readDb();
    const userIndex = data.users.findIndex(u => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // تصفية أمان: الطالب لا يمكنه تعديل حساب طالب آخر
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

    db.writeDb(data);

    const { password: _, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'فشل تحديث بيانات الملف الشخصي' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
