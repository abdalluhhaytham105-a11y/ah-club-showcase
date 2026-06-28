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
      email: 'Abdalluh',
      phone: '01000000000',
      university: 'AH CLUB University',
      major: 'Computer Science',
      password: '123',
      role: 'admin'
    },
    {
      id: "user-1782570371406",
      name: "Abdalluh haytham",
      email: "abdalluhhaytham4066@gmail.com",
      phone: "01202217795",
      university: "aiu",
      major: "pharmacy",
      password: "Abdalluh4066",
      role: "student",
      discountPercent: 100
    }
  ],
  projects: [
    {
      id: "proj-1782574789895",
      title: "Development of Prophet Daniel Street",
      category: "cs",
      college: "جامعه العلمين",
      description: "يعد شارع النبي دانيال أحد أقدم وأهم المحاور العمرانية والتاريخية في مدينة الإسكندرية؛ حيث يربط بين مختلف العصور التاريخية والثقافية التي مرت بها المدينة.",
      techUsed: "canva , image fx , gemini",
      image: "/uploads/1782575213912-74606591-Screenshot 2026-06-27 184630.png",
      link: "/uploads/1782575213922-329122509-Development of Prophet Daniel Street.pdf"
    }
  ],
  requests: [
    {
      id: "req-1782571370882",
      studentId: "user-1782570371406",
      studentName: "Abdalluh haytham",
      title: "dscdscsc",
      category: "cs",
      college: "cdsccsdd",
      description: "cdscdscdscs",
      techNeeded: "scsdcsdcsdsd",
      deadline: "2026-06-26",
      status: "completed",
      price: 200,
      paymentMethod: "Vodafone Cash",
      transactionId: "9126551602236",
      attachmentFile: "",
      deliveryFile: "https://github.com/abdalluhhaytham105-a11y/ah-club-showcase",
      createdAt: "2026-06-27T14:42:50.882Z",
      rating: 5,
      ratingComment: ""
    }
  ],
  announcements: [],
  projectRatings: []
};

// تحديد المتغيرات وعناوين الـ API لقاعدة بيانات Upstash / Vercel KV بمختلف المسميات الممكنة
const KV_URL = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL || process.env.STORAGE_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN || process.env.STORAGE_TOKEN;

// فحص وجود تفعيل قاعدة بيانات سحابية Upstash Redis
const isKvEnabled = !!(KV_URL && KV_TOKEN);

// استخدام ذاكرة مؤقتة لتقليل عدد مرات استدعاء الـ API من Upstash
let memoryCache = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3 ثوانٍ

async function readDb() {
  if (isKvEnabled) {
    const now = Date.now();
    if (memoryCache && (now - lastCacheTime < CACHE_TTL)) {
      return memoryCache;
    }
    try {
      // تنظيف الروابط للتأكد من عدم وجود مسافات أو مشكلات
      const cleanUrl = KV_URL.trim();
      const cleanToken = KV_TOKEN.trim();

      const response = await fetch(`${cleanUrl}/get/ah_club_db`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      const resData = await response.json();
      let parsed = initialDb;
      if (resData && resData.result) {
        parsed = JSON.parse(resData.result);
      } else {
        // تهيئة قاعدة البيانات لأول مرة
        await writeDb(initialDb);
      }
      
      // تأكيد وجود حساب الأدمن دائماً
      let admin = parsed.users.find(u => u.role === 'admin' || u.id === 'admin-id-123');
      if (admin) {
        if (admin.name !== 'Abdalluh haytham' || admin.email !== 'Abdalluh' || admin.password !== '123') {
          admin.name = 'Abdalluh haytham';
          admin.email = 'Abdalluh';
          admin.password = '123';
          await writeDb(parsed);
        }
      }
      if (!parsed.announcements) {
        parsed.announcements = [];
        await writeDb(parsed);
      }
      if (!parsed.projectRatings) {
        parsed.projectRatings = [];
        await writeDb(parsed);
      }

      memoryCache = parsed;
      lastCacheTime = now;
      return parsed;
    } catch (err) {
      console.error('Error reading from Upstash Redis, falling back to local database:', err);
      return memoryCache || initialDb;
    }
  } else {
    // التشغيل المحلي الافتراضي
    try {
      if (!fs.existsSync(DB_PATH)) {
        writeDbSync(initialDb);
        return initialDb;
      }
      const data = fs.readFileSync(DB_PATH, 'utf8');
      let parsed = JSON.parse(data);
      
      let admin = parsed.users.find(u => u.role === 'admin' || u.id === 'admin-id-123');
      if (admin) {
        if (admin.name !== 'Abdalluh haytham' || admin.email !== 'Abdalluh' || admin.password !== '123') {
          admin.name = 'Abdalluh haytham';
          admin.email = 'Abdalluh';
          admin.password = '123';
          writeDbSync(parsed);
        }
      }
      if (!parsed.announcements) {
        parsed.announcements = [];
        writeDbSync(parsed);
      }
      if (!parsed.projectRatings) {
        parsed.projectRatings = [];
        writeDbSync(parsed);
      }
      return parsed;
    } catch (error) {
      console.error('Error reading database file:', error);
      return initialDb;
    }
  }
}

async function writeDb(data) {
  memoryCache = data;
  lastCacheTime = Date.now();
  if (isKvEnabled) {
    try {
      const cleanUrl = KV_URL.trim();
      const cleanToken = KV_TOKEN.trim();

      const response = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'ah_club_db', JSON.stringify(data)])
      });
      return response.ok;
    } catch (err) {
      console.error('Error writing to Upstash Redis:', err);
      return false;
    }
  } else {
    return writeDbSync(data);
  }
}

function writeDbSync(data) {
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
