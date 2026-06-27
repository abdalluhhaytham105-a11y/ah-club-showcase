const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.json');

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
    },
    {
      id: 'proj-3',
      title: 'دراسة جدوى تسويقية ومالية لمشروع طاقة متجددة',
      category: 'business',
      college: 'كلية التجارة وإدارة الأعمال',
      description: 'دراسة جدوى شاملة تغطي التحليل المالي، حساب الـ ROI، تقييم المخاطر، وخطة تسويقية متكاملة لإطلاق شركة ناشئة متخصصة في تركيب الألواح الشمسية.',
      techUsed: 'MS Excel, Financial Modeling, Market Research',
      image: '/logo.png',
      link: '#'
    },
    {
      id: 'proj-4',
      title: 'نظام فحص وفلترة السير الذاتية بالذكاء الاصطناعي',
      category: 'cs',
      college: 'كلية الحاسبات والمعلومات',
      description: 'تطبيق ويب يقوم بقراءة ملفات الـ PDF للسير الذاتية وتصنيفها ومطابقتها مع الوصف الوظيفي بناءً على الكلمات المفتاحية والـ NLP وترتيب المتقدمين.',
      techUsed: 'Python, Flask, NLTK, Spacy, React',
      image: '/logo.png',
      link: '#'
    },
    {
      id: 'proj-5',
      title: 'تصميم وتحليل إنشائي لبرج سكني 15 طابق',
      category: 'engineering',
      college: 'كلية الهندسة - قسم مدني',
      description: 'تصميم هندسي إنشائي كامل لبرج سكني يحتوي على حسابات الأحمال الزلزالية والرياح، وتصميم القواعد والأعمدة والأسقف باستخدام البرامج الهندسية المعتمدة.',
      techUsed: 'AUTOCAD, ETABS, SAFE, Excel Sheets',
      image: '/logo.png',
      link: '#'
    },
    {
      id: 'proj-6',
      title: 'تطبيق محادثة فوري مشفر (Encrypted Chat App)',
      category: 'cs',
      college: 'كلية الحاسبات والمعلومات',
      description: 'برنامج محادثة فوري يتيح للمستخدمين إنشاء غرف دردشة آمنة ومشفرة بالكامل بنظام End-to-End Encryption لحماية خصوصية البيانات.',
      techUsed: 'Java, Socket Programming, AES Encryption',
      image: '/logo.png',
      link: '#'
    }
  ],
  requests: []
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(initialDb);
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    let parsed = JSON.parse(data);
    if (!parsed.categories) {
      parsed.categories = [
        { id: 'cs', label: 'حاسبات وبرمجيات' },
        { id: 'engineering', label: 'هندسة وميكاترونكس' },
        { id: 'business', label: 'إدارة وأبحاث' }
      ];
      writeDb(parsed);
    }
    
    // هجرة بيانات الأدمن للتعديل الجديد
    let admin = parsed.users.find(u => u.role === 'admin' || u.id === 'admin-id-123');
    if (admin) {
      if (admin.name !== 'Abdalluh haytham' || admin.email !== 'Abdalluh haytham' || admin.password !== 'Admin') {
        admin.name = 'Abdalluh haytham';
        admin.email = 'Abdalluh haytham';
        admin.password = 'Admin';
        writeDb(parsed);
      }
    }
    return parsed;
  } catch (error) {
    console.error('Error reading database:', error);
    return initialDb;
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// تهيئة قاعدة البيانات عند بدء التشغيل
readDb();

module.exports = {
  readDb,
  writeDb
};
