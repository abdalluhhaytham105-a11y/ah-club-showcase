const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://abdalluhhaytham105_db_user:8KN5Tr6JWOhQy5zu@boda.udwjh9l.mongodb.net/?appName=boda";

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
  specialOffer: { type: String, default: '' }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// 2. تعريف موديل الأرشيف العام للمشاريع
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

// 3. تعريف موديل طلبات الطلاب الجارية
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
  status: { type: String, default: 'pending' },
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

let isConnected = false;

async function connectToMongo() {
  if (isConnected) return true;
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB Atlas successfully!');
    await seedDefaultData();
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    return false;
  }
}

async function seedDefaultData() {
  try {
    // 1. تهيئة الأدمن الافتراضي إذا لم يكن موجوداً
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      await User.create({
        id: 'admin-id-123',
        name: 'Abdalluh haytham',
        email: 'Abdalluh haytham',
        phone: '01000000000',
        university: 'AH CLUB University',
        major: 'Computer Science',
        password: 'Admin',
        role: 'admin'
      });
      console.log('Seeded default admin user successfully!');
    }

    // 2. تهيئة تصنيفات وأقسام المشاريع الافتراضية
    const categoryCount = await Category.countDocuments();
    if (categoryCount === 0) {
      await Category.insertMany([
        { id: 'cs', label: 'حاسبات وبرمجيات' },
        { id: 'engineering', label: 'هندسة وميكاترونكس' },
        { id: 'business', label: 'إدارة وأبحاث' }
      ]);
      console.log('Seeded default categories successfully!');
    }

    // 3. تهيئة مشاريع الأرشيف الافتراضية
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
        },
        {
          id: 'proj-2',
          title: 'تطبيق ويب لتسجيل الحضور بالبصمة أو الـ RFID',
          category: 'cs',
          college: 'كلية الحاسبات والمعلومات',
          description: 'نظام ويب كامل لتسجيل حضور الموظفين أو الطلاب باستخدام بطاقات RFID متصلة بقاعدة بيانات مركزية تعرض التقارير وإحصائيات الحضور والغياب للـ HR.',
          techUsed: 'Node.js, Express, SQLite, RFID RC522, HTML/CSS',
          image: '/logo.png',
          link: '#'
        }
      ]);
      console.log('Seeded default projects successfully!');
    }
  } catch (err) {
    console.error('Error seeding default data:', err);
  }
}

module.exports = {
  User,
  Project,
  Request,
  Category,
  connectToMongo
};
