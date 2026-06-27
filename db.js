const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DB_PATH = path.join(__dirname, 'database.json');
const MONGODB_URI = process.env.MONGODB_URI;

const initialDb = {
  categories: [
    { id: 'cs', label: 'حاسبات وبرمجيات' },
    { id: 'engineering', label: 'هندسة وميكاترونكس' },
    { id: 'business', label: 'إدارة وأبحاث' }
  ],
  users: [
    {
      id: 'admin-id-123',
      name: 'Abdalluh haytham',
      email: 'Abdalluh haytham',
      phone: '01000000000',
      university: 'AH CLUB University',
      major: 'Computer Science',
      password: 'Admin',
      role: 'admin'
    }
  ],
  projects: [
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
  ],
  requests: []
};

// تعريف موديل Mongoose لتخزين الملف بالكامل في مستند سحابي واحد
const dbSchema = new mongoose.Schema({
  key: { type: String, default: 'ah-club-db-store', unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: initialDb }
});

const DbModel = mongoose.models.DbStore || mongoose.model('DbStore', dbSchema);

let isConnected = false;

async function connectToMongo() {
  if (isConnected) return true;
  if (!MONGODB_URI) {
    return false;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log('Connected to MongoDB Atlas successfully!');
    return true;
  } catch (err) {
    console.error('Failed to connect to MongoDB Atlas:', err);
    return false;
  }
}

async function readDb() {
  const hasMongo = await connectToMongo();
  if (hasMongo) {
    try {
      let doc = await DbModel.findOne({ key: 'ah-club-db-store' });
      if (!doc) {
        // إذا كان فارغاً، نحاول قراءة الملف المحلي لترحيله للسحابة حتى لا تضيع البيانات الحالية
        let localData = initialDb;
        if (fs.existsSync(DB_PATH)) {
          try {
            localData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
          } catch (e) {}
        }
        doc = await DbModel.create({ key: 'ah-club-db-store', data: localData });
      }
      return doc.data;
    } catch (err) {
      console.error('Error reading from MongoDB Atlas, falling back to local file:', err);
    }
  }

  // المحاذاة والرجوع للملف المحلي في حالة عدم وجود MONGODB_URI (بيئة التطوير المحلية مثلاً)
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf8');
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    let parsed = JSON.parse(data);
    
    // هجرة بيانات الأدمن في حال تغيرت في الكود
    let admin = parsed.users.find(u => u.role === 'admin' || u.id === 'admin-id-123');
    if (admin) {
      if (admin.name !== 'Abdalluh haytham' || admin.email !== 'Abdalluh haytham' || admin.password !== 'Admin') {
        admin.name = 'Abdalluh haytham';
        admin.email = 'Abdalluh haytham';
        admin.password = 'Admin';
        fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf8');
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database file:', error);
    return initialDb;
  }
}

async function writeDb(data) {
  const hasMongo = await connectToMongo();
  if (hasMongo) {
    try {
      await DbModel.updateOne({ key: 'ah-club-db-store' }, { data }, { upsert: true });
      return true;
    } catch (err) {
      console.error('Error writing to MongoDB Atlas, falling back to local file:', err);
    }
  }

  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database file:', error);
    return false;
  }
}

module.exports = {
  readDb,
  writeDb
};
