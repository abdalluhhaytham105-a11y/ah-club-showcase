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
  announcements: []
};

function readDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      writeDb(initialDb);
      return initialDb;
    }
    const data = fs.readFileSync(DB_PATH, 'utf8');
    let parsed = JSON.parse(data);
    
    // تأكيد وجود حساب الأدمن دائماً
    let admin = parsed.users.find(u => u.role === 'admin' || u.id === 'admin-id-123');
    if (admin) {
      if (admin.email !== 'Abdalluh' || admin.password !== '123') {
        admin.name = 'Abdalluh haytham';
        admin.email = 'Abdalluh';
        admin.password = '123';
        writeDb(parsed);
      }
    }
    
    if (!parsed.announcements) {
      parsed.announcements = [];
      writeDb(parsed);
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

module.exports = {
  readDb,
  writeDb
};
