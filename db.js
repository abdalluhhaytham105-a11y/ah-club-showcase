const mongoose = require('mongoose');

const envUri = process.env.MONGODB_URI;
const MONGODB_URI = (envUri && envUri.trim().startsWith('mongodb')) 
  ? envUri.trim() 
  : "mongodb+srv://abdalluhhaytham105_db_user:KN5Tr6JWOhQy5zu@boda.udwjh9l.mongodb.net/boda?retryWrites=true&w=majority&appName=boda";

// 1. تعريف موديل المستخدم
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  university: { type: String, required: true },
  major: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'admin'], default: 'student' },
  discountPercent: { type: Number, default: 0 },
  specialOffer: { type: String, default: '' },
  profileImage: { type: String, default: '' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// 2. تعريف موديل المشاريع في الأرشيف
const projectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  college: { type: String, required: true },
  description: { type: String, required: true },
  techUsed: { type: String, required: true },
  image: { type: String, default: '/logo.png' },
  link: { type: String, default: '#' }
});

const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);

// 3. تعريف موديل طلبات المشاريع للطلاب
const requestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, required: true },
  college: { type: String, required: true },
  description: { type: String, required: true },
  techNeeded: { type: String, default: 'غير محدد' },
  deadline: { type: String, required: true },
  status: { type: String, default: 'pending' }, // pending, priced, ready_payment_verify, paid, completed
  price: { type: Number, default: 0 },
  paymentMethod: { type: String, default: '' },
  transactionId: { type: String, default: '' },
  attachmentFile: { type: String, default: '' },
  deliveryFile: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  ratingComment: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);

// 4. تعريف موديل أقسام وتصنيفات المشاريع
const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  label: { type: String, required: true }
});

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

// 5. تعريف موديل الإعلانات والتنبيهات
const announcementSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  durationDays: { type: Number, required: true },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);

async function connectToMongo() {
  if (mongoose.connection.readyState === 1) return true;
  try {
    if (mongoose.connection.readyState === 2) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (mongoose.connection.readyState === 1) return true;
    }
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // ينهي المحاولة بعد 5 ثوانٍ
    });
    console.log('Connected to MongoDB Atlas successfully!');
    await seedDefaultData();
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    throw err;
  }
}

async function seedDefaultData() {
  try {
    // 1. حساب الأدمن الافتراضي
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const defaultAdmin = new User({
        id: 'admin-id-123',
        name: 'Abdalluh haytham',
        email: 'Abdalluh',
        phone: '01000000000',
        university: 'AH CLUB University',
        major: 'Computer Science',
        password: '123',
        role: 'admin'
      });
      await defaultAdmin.save();
      console.log('Default admin seeded.');
    } else {
      // التأكد من تطابق بيانات الأدمن في قاعدة البيانات
      if (adminExists.email !== 'Abdalluh' || adminExists.password !== '123') {
        adminExists.email = 'Abdalluh';
        adminExists.password = '123';
        await adminExists.save();
        console.log('Default admin credentials synced.');
      }
    }

    // 2. تصنيفات المشاريع الافتراضية
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      await Category.insertMany([
        { id: 'cs', label: 'حاسبات وبرمجيات' },
        { id: 'engineering', label: 'هندسة وميكاترونكس' },
        { id: 'business', label: 'إدارة وأبحاث' }
      ]);
      console.log('Default categories seeded.');
    }

    // 3. مشاريع الأرشيف الافتراضية
    const projectCount = await Project.countDocuments();
    if (projectCount === 0) {
      await Project.insertMany([
        {
          id: 'proj-1',
          title: 'نظام الري الذكي باستخدام IoT',
          category: 'engineering',
          college: 'كلية الهندسة',
          description: 'نظام متكامل يعتمد على مستشعرات الرطوبة ودرجة الحرارة لمراقبة التربة وري النباتات تلقائياً عبر تطبيق موبايل، مع لوحة تحكم لقراءة البيانات لحظياً.',
          techUsed: 'Arduino, ESP8266, Soil Sensor, Blynk, Firebase',
          image: '/logo.png',
          link: '#'
        }
      ]);
      console.log('Default projects seeded.');
    }
  } catch (err) {
    console.error('Error seeding default data:', err);
  }
}

module.exports = {
  connectToMongo,
  User,
  Project,
  Request,
  Category,
  Announcement
};
