const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = 3000;

// التأكد من وجود مجلد الرفع (مع تجنب التعطل في البيئات السيرفرلس مثل Vercel)
const uploadDir = path.join(__dirname, 'public', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('Warning: Could not create uploads directory (might be running in a read-only serverless environment):', err.message);
}

// إعداد Multer لرفع الملفات مع التحويل لمجلد /tmp مؤقتاً في Vercel
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (process.env.VERCEL || !fs.existsSync(uploadDir)) {
      cb(null, '/tmp');
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
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
// 1. نظام التحقق والحسابات (Authentication)
// ----------------------------------------------------

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, university, major, password } = req.body;
  if (!name || !email || !phone || !university || !major || !password) {
    return res.status(400).json({ error: 'من فضلك املأ جميع الحقول' });
  }

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
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'من فضلك ادخل البريد الإلكتروني وكلمة المرور' });
  }

  const data = db.readDb();
  const user = data.users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
  }

  const { password: _, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

// ----------------------------------------------------
// 2. إدارة مشاريع الأرشيف المعروضة للكل
// ----------------------------------------------------

app.get('/api/projects', (req, res) => {
  const data = db.readDb();
  res.json(data.projects);
});

app.post('/api/projects', archiveUpload, (req, res) => {
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

  data.projects.unshift(newProject); // وضع الجديد في البداية
  db.writeDb(data);
  res.status(201).json(newProject);
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const data = db.readDb();
  const index = data.projects.findIndex(p => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'المشروع غير موجود' });
  }
  data.projects.splice(index, 1);
  db.writeDb(data);
  res.json({ message: 'تم حذف المشروع بنجاح' });
});

app.put('/api/projects/:id', archiveUpload, (req, res) => {
  const { id } = req.params;
  const { title, category, college, description, techUsed, link } = req.body;

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
});

// ----------------------------------------------------
// 2.5 إدارة الأقسام والتصنيفات (Categories Management)
// ----------------------------------------------------
app.get('/api/categories', (req, res) => {
  const data = db.readDb();
  res.json(data.categories || []);
});

app.post('/api/categories', (req, res) => {
  const { label } = req.body;
  if (!label) {
    return res.status(400).json({ error: 'اسم القسم مطلوب' });
  }

  const data = db.readDb();
  const id = 'cat-' + Date.now();
  const newCategory = { id, label };
  
  if (!data.categories) {
    data.categories = [];
  }
  data.categories.push(newCategory);
  db.writeDb(data);
  res.status(201).json(newCategory);
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
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
});

// ----------------------------------------------------
// 3. إدارة طلبات الطلاب والمشاريع الجارية
// ----------------------------------------------------

// جلب الطلبات (للأدمن أو للطالب المعين)
app.get('/api/requests', (req, res) => {
  const { studentId } = req.query;
  const data = db.readDb();

  if (studentId) {
    const studentRequests = data.requests.filter(r => r.studentId === studentId);
    return res.json(studentRequests);
  }

  // للأدمن: إرجاع كافة الطلبات
  res.json(data.requests);
});

// تقديم طلب مشروع جديد (مع إمكانية رفع ملف إرشادات)
app.post('/api/requests', upload.single('attachment'), (req, res) => {
  const { studentId, studentName, title, category, college, description, techNeeded, deadline } = req.body;
  
  if (!studentId || !studentName || !title || !category || !college || !description || !deadline) {
    return res.status(400).json({ error: 'من فضلك املأ جميع بيانات الاستمارة الأساسية' });
  }

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
    status: 'pending', // pending -> accepted -> in_progress -> ready_payment -> paid -> completed
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
});

// تحديث حالة الطلب والتسعير (للأدمن)
app.put('/api/requests/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, price } = req.body;

  const data = db.readDb();
  const requestIndex = data.requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  if (status) data.requests[requestIndex].status = status;
  if (price !== undefined) data.requests[requestIndex].price = Number(price);

  db.writeDb(data);
  res.json(data.requests[requestIndex]);
});

// إرسال بيانات الدفع (للطالب)
app.put('/api/requests/:id/pay', (req, res) => {
  const { id } = req.params;
  const { paymentMethod, transactionId } = req.body;

  if (!paymentMethod || !transactionId) {
    return res.status(400).json({ error: 'الرجاء إدخال وسيلة الدفع ورقم التحويل' });
  }

  const data = db.readDb();
  const requestIndex = data.requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  data.requests[requestIndex].paymentMethod = paymentMethod;
  data.requests[requestIndex].transactionId = transactionId;
  data.requests[requestIndex].status = 'ready_payment_verify'; // في انتظار تأكيد الأدمن

  db.writeDb(data);
  res.json(data.requests[requestIndex]);
});

// تأكيد استلام الدفع (للأدمن)
app.put('/api/requests/:id/confirm-payment', (req, res) => {
  const { id } = req.params;

  const data = db.readDb();
  const requestIndex = data.requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  data.requests[requestIndex].status = 'paid';
  db.writeDb(data);
  res.json(data.requests[requestIndex]);
});

// تسليم ملف المشروع النهائي للطلب (للأدمن)
app.put('/api/requests/:id/deliver', upload.single('delivery'), (req, res) => {
  const { id } = req.params;
  const { deliveryLink } = req.body;

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

  data.requests[requestIndex].status = 'completed'; // تم التسليم بنجاح
  db.writeDb(data);
  res.json(data.requests[requestIndex]);
});

// تقييم المشروع المنجز من قبل الطالب (اختياري)
app.put('/api/requests/:id/rate', (req, res) => {
  const { id } = req.params;
  const { rating, ratingComment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'الرجاء إدخال تقييم صحيح بين 1 و 5 نجوم' });
  }

  const data = db.readDb();
  const requestIndex = data.requests.findIndex(r => r.id === id);

  if (requestIndex === -1) {
    return res.status(404).json({ error: 'الطلب غير موجود' });
  }

  // يمكن التقييم فقط للمشاريع المكتملة
  if (data.requests[requestIndex].status !== 'completed') {
    return res.status(400).json({ error: 'يمكنك تقييم الطلب بعد تسليمه وإنجازه فقط' });
  }

  data.requests[requestIndex].rating = Number(rating);
  data.requests[requestIndex].ratingComment = ratingComment || '';

  db.writeDb(data);
  res.json(data.requests[requestIndex]);
});

// جلب الإحصائيات العامة الديناميكية للموقع
app.get('/api/stats', (req, res) => {
  const data = db.readDb();

  // حساب نسبة الرضا بناءً على متوسط التقييمات الفردية
  const completedWithRating = data.requests.filter(r => r.status === 'completed' && r.rating);
  let satisfactionRate = 98; // قيمة افتراضية في البداية

  if (completedWithRating.length > 0) {
    const totalRating = completedWithRating.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / completedWithRating.length; // من 5
    satisfactionRate = Math.round((avgRating / 5) * 100);
  }

  // عدد المشاريع المنجزة = 300 مشروع سابق + عدد الطلبات المكتملة حديثاً عبر الموقع
  const completedCount = 300 + data.requests.filter(r => r.status === 'completed').length;

  res.json({
    completedCount: completedCount,
    satisfactionRate: satisfactionRate
  });
});

// ----------------------------------------------------
// 4. إدارة لوحة الطلاب والمطورين المتقدمة
// ----------------------------------------------------

// جلب قائمة الطلاب وإحصائياتهم للأدمن
app.get('/api/students', (req, res) => {
  const data = db.readDb();
  const students = data.users.filter(u => u.role === 'student');
  
  // حساب عدد الطلبات لكل طالب
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
      ordersCount: studentOrders.length,
      totalSpent
    };
  });

  res.json(studentListWithStats);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
