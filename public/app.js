document.addEventListener('DOMContentLoaded', () => {
  // حالة المستخدم الحالية
  let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

  // تفعيل التوقيع التلقائي لجميع الطلبات بمعرف المستخدم الحالي للتحقق من الصلاحيات بالخادم
  const originalFetch = window.fetch;
  window.fetch = function (url, options = {}) {
    options.headers = options.headers || {};
    if (currentUser && currentUser.id) {
      options.headers['x-user-id'] = currentUser.id;
    }
    return originalFetch(url, options);
  };

  let allProjects = [];
  let categories = [];

  // العناصر العامة بالصفحة
  const headerLogo = document.getElementById('header-logo');
  const navHome = document.getElementById('nav-home');
  const navPortal = document.getElementById('nav-portal');
  const navAdmin = document.getElementById('nav-admin');
  const authButtonsContainer = document.getElementById('auth-buttons-container');
  const userProfileContainer = document.getElementById('user-profile-container');
  const userWelcomeMsg = document.getElementById('user-welcome-msg');
  const btnLogout = document.getElementById('btn-logout');

  // أزرار التحقق
  const btnLoginTrigger = document.getElementById('btn-login-trigger');
  const btnRegisterTrigger = document.getElementById('btn-register-trigger');
  const authModal = document.getElementById('auth-modal');
  const authModalClose = document.getElementById('auth-modal-close');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const authModalTitle = document.getElementById('auth-modal-title');

  // أقسام الصفحة الرئيسية
  const landingView = document.getElementById('landing-view');
  const studentPortalView = document.getElementById('student-portal-view');
  const heroOrderBtn = document.getElementById('hero-order-btn');

  // تصفية وبحث الأرشيف
  const projectSearch = document.getElementById('project-search');
  const filtersContainer = document.getElementById('filters-container');
  const projectsListContainer = document.getElementById('projects-list-container');

  // مودال تفاصيل المشروع بالأرشيف
  const projectDetailModal = document.getElementById('project-detail-modal');
  const projDetailClose = document.getElementById('proj-detail-close');
  const projDetailBtnClose = document.getElementById('proj-detail-btn-close');
  const projDetailTitle = document.getElementById('proj-detail-title');
  const projDetailCollege = document.getElementById('proj-detail-college');
  const projDetailDescription = document.getElementById('proj-detail-description');
  const projDetailTags = document.getElementById('proj-detail-tags');

  // تابات البوابة للطلاب
  const menuMyDashboard = document.getElementById('menu-my-dashboard');
  const menuMyRequests = document.getElementById('menu-my-requests');
  const menuNewRequest = document.getElementById('menu-new-request');
  const portalDashboardPanel = document.getElementById('portal-dashboard-panel');
  const portalRequestsPanel = document.getElementById('portal-requests-panel');
  const portalNewRequestPanel = document.getElementById('portal-new-request-panel');
  const studentRequestsTableBody = document.getElementById('student-requests-table-body');
  const newRequestForm = document.getElementById('new-request-form');

  // مودال تتبع الطلب والدفع
  const orderStatusModal = document.getElementById('order-status-modal');
  const orderStatusClose = document.getElementById('order-status-close');
  const orderTitleModal = document.getElementById('order-title-modal');
  const orderPriceDisplay = document.getElementById('order-price-display');
  const paymentPricingInfo = document.getElementById('payment-pricing-info');
  const paymentInstructions = document.getElementById('payment-instructions');
  const paymentVerifyPending = document.getElementById('payment-verify-pending');
  const deliveryDownloadInfo = document.getElementById('delivery-download-info');
  const orderPendingReviewInfo = document.getElementById('order-pending-review-info');
  const paymentSubmissionForm = document.getElementById('payment-submission-form');
  const btnDownloadProjectFiles = document.getElementById('btn-download-project-files');

  let activeTrackedOrderId = null;

  // ----------------------------------------------------
  // تهيئة وتنسيق الدخول
  // ----------------------------------------------------
  function updateAuthUI() {
    if (currentUser) {
      authButtonsContainer.classList.add('hidden');
      userProfileContainer.classList.remove('hidden');
      userWelcomeMsg.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> مرحباً، ${currentUser.name.split(' ')[0]}`;
      navPortal.classList.remove('hidden');
      
      if (currentUser.role === 'admin') {
        navAdmin.classList.remove('hidden');
      } else {
        navAdmin.classList.add('hidden');
      }

      // تفعيل الثيم الذهبي العام في حال كان الخصم 100%
      if (currentUser && Number(currentUser.discountPercent) === 100) {
        document.body.classList.add('gold-theme');
      } else {
        document.body.classList.remove('gold-theme');
      }
    } else {
      authButtonsContainer.classList.remove('hidden');
      userProfileContainer.classList.add('hidden');
      navPortal.classList.add('hidden');
      navAdmin.classList.add('hidden');
      showSection('landing');
      document.body.classList.remove('gold-theme');
    }
  }

  function showSection(section) {
    if (section === 'landing') {
      landingView.classList.remove('hidden');
      studentPortalView.classList.add('hidden');
      navHome.classList.add('active');
      navPortal.classList.remove('active');
      animateCounters();
    } else if (section === 'portal') {
      if (!currentUser) {
        openAuthModal('login');
        return;
      }
      landingView.classList.add('hidden');
      studentPortalView.classList.remove('hidden');
      navHome.classList.remove('active');
      navPortal.classList.add('active');
      loadPortalData();
    }
  }

  // التنقل بين الأقسام
  navHome.addEventListener('click', (e) => { e.preventDefault(); showSection('landing'); });
  navPortal.addEventListener('click', (e) => { e.preventDefault(); showSection('portal'); });
  heroOrderBtn.addEventListener('click', () => { showSection('portal'); showPortalPanel('new-request'); });

  // ----------------------------------------------------
  // نظام النوافذ المنبثقة للتحقق والـ Auth
  // ----------------------------------------------------
  function openAuthModal(tab = 'login') {
    authModal.classList.add('active');
    switchAuthTab(tab);
  }

  function closeAuthModal() {
    authModal.classList.remove('active');
  }

  function switchAuthTab(tab) {
    if (tab === 'login') {
      tabLogin.classList.add('active');
      tabRegister.classList.remove('active');
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      authModalTitle.innerText = 'تسجيل الدخول للمنصة';
    } else {
      tabLogin.classList.remove('active');
      tabRegister.classList.add('active');
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      authModalTitle.innerText = 'إنشاء حساب طالب جديد';
    }
  }

  btnLoginTrigger.addEventListener('click', () => openAuthModal('login'));
  btnRegisterTrigger.addEventListener('click', () => openAuthModal('register'));
  authModalClose.addEventListener('click', closeAuthModal);
  tabLogin.addEventListener('click', () => switchAuthTab('login'));
  tabRegister.addEventListener('click', () => switchAuthTab('register'));

  // إرسال نموذج الدخول
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء الدخول');
        return;
      }

      currentUser = data;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showSection('portal');
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // إرسال نموذج إنشاء الحساب
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const university = document.getElementById('reg-university').value;
    const major = document.getElementById('reg-major').value;
    const password = document.getElementById('reg-password').value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, university, major, password })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء التسجيل');
        return;
      }

      currentUser = data;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      updateAuthUI();
      closeAuthModal();
      showSection('portal');
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // تسجيل الخروج
  btnLogout.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthUI();
  });

  // ----------------------------------------------------
  // جلب وعرض الأرشيف العام للمشاريع
  // ----------------------------------------------------
  async function fetchCategories() {
    try {
      const response = await fetch('/api/categories');
      categories = await response.json();
      renderCategoryFilters();
      renderCategorySelects();
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }

  function renderCategoryFilters() {
    filtersContainer.innerHTML = `<button class="filter-tab active" data-category="all">الكل</button>`;
    categories.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'filter-tab';
      btn.setAttribute('data-category', c.id);
      btn.innerText = c.label;
      filtersContainer.appendChild(btn);
    });
  }

  function renderCategorySelects() {
    const reqCategorySelect = document.getElementById('req-category');
    if (reqCategorySelect) {
      reqCategorySelect.innerHTML = '';
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.label;
        reqCategorySelect.appendChild(opt);
      });
      const optOther = document.createElement('option');
      optOther.value = 'other';
      optOther.innerText = 'تخصص آخر';
      reqCategorySelect.appendChild(optOther);
    }
  }

  async function fetchArchiveProjects() {
    try {
      const response = await fetch('/api/projects');
      allProjects = await response.json();
      renderProjects(allProjects);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }

  function renderProjects(projects) {
    projectsListContainer.innerHTML = '';
    if (projects.length === 0) {
      projectsListContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 3rem;">لا توجد مشاريع مطابقة للبحث حالياً.</div>`;
      return;
    }

    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="project-image-box">
          <img src="${p.image}" alt="${p.title}" class="project-thumbnail">
          <span class="project-category">${getCategoryLabel(p.category)}</span>
        </div>
        <div class="project-body">
          <span class="project-college">${p.college}</span>
          <h3 class="project-card-title">${p.title}</h3>
          <p class="project-card-description">${p.description}</p>
          <div class="project-tags">
            ${p.techUsed.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
          </div>
          <div class="project-footer">
            <button class="project-more-btn" data-id="${p.id}">تفاصيل المشروع <i class="fa-solid fa-arrow-left"></i></button>
          </div>
        </div>
      `;
      projectsListContainer.appendChild(card);
    });

    // إضافة مستمعات حدث أزرار التفاصيل
    document.querySelectorAll('.project-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openProjectDetail(id);
      });
    });
  }

  function getCategoryLabel(cat) {
    if (cat === 'all') return 'الكل';
    const found = categories.find(c => c.id === cat);
    return found ? found.label : (cat === 'other' ? 'تخصص آخر' : cat);
  }

  // البحث والفلترة
  projectSearch.addEventListener('input', filterArchive);
  filtersContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tab')) {
      document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
      e.target.classList.add('active');
      filterArchive();
    }
  });

  function normalizeArabic(text) {
    if (!text) return '';
    return text.toString().toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }

  function filterArchive() {
    const query = projectSearch.value.trim();
    const activeTab = document.querySelector('.filter-tab.active');
    const category = activeTab ? activeTab.getAttribute('data-category') : 'all';

    let filtered = allProjects;

    if (category !== 'all') {
      filtered = filtered.filter(p => p.category === category);
    }

    if (query !== '') {
      const normalizedQuery = normalizeArabic(query);
      filtered = filtered.filter(p => 
        normalizeArabic(p.title).includes(normalizedQuery) || 
        normalizeArabic(p.description).includes(normalizedQuery) || 
        normalizeArabic(p.techUsed).includes(normalizedQuery) ||
        normalizeArabic(p.college).includes(normalizedQuery)
      );
    }

    renderProjects(filtered);
  }

  // فتح تفاصيل المشروع المنفرد
  function openProjectDetail(id) {
    const project = allProjects.find(p => p.id === id);
    if (!project) return;

    projDetailTitle.innerText = project.title;
    projDetailCollege.innerHTML = `<i class="fa-solid fa-university"></i> ${project.college}`;
    projDetailDescription.innerText = project.description;
    
    // إظهار وإعداد صورة الغلاف
    const detailImg = document.getElementById('proj-detail-image');
    const detailImgWrapper = document.getElementById('proj-detail-image-wrapper');
    if (detailImg && detailImgWrapper) {
      if (project.image && project.image !== '/logo.png') {
        detailImg.src = project.image;
        detailImg.style.objectFit = 'contain'; // افتراضياً احتواء ذكي لتفاصيل الصورة
        detailImgWrapper.style.display = 'block';
        
        // تحديث نص زر التمديد
        const toggleFitBtn = document.getElementById('btn-toggle-fit');
        if (toggleFitBtn) {
          toggleFitBtn.innerHTML = '<i class="fa-solid fa-expand"></i> تمديد الصورة';
        }
      } else {
        detailImgWrapper.style.display = 'none';
      }
    }

    // إعداد زر التحميل لملفات الأرشيف
    const downloadContainer = document.getElementById('proj-detail-download-container');
    const downloadBtn = document.getElementById('proj-detail-download-btn');
    if (downloadContainer && downloadBtn) {
      if (project.link && project.link !== '#') {
        downloadBtn.href = project.link;
        if (project.link.startsWith('http://') || project.link.startsWith('https://')) {
          downloadBtn.removeAttribute('download');
          downloadBtn.setAttribute('target', '_blank');
          downloadBtn.innerHTML = 'فتح رابط ملفات المشروع خارجيّاً <i class="fa-solid fa-arrow-up-right-from-square"></i>';
        } else {
          downloadBtn.setAttribute('download', '');
          downloadBtn.removeAttribute('target');
          downloadBtn.innerHTML = 'تحميل ملف وكود المشروع <i class="fa-solid fa-download"></i>';
        }
        downloadContainer.style.display = 'block';
      } else {
        downloadContainer.style.display = 'none';
      }
    }
    
    projDetailTags.innerHTML = '';
    project.techUsed.split(',').forEach(tag => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerText = tag.trim();
      projDetailTags.appendChild(span);
    });

    projectDetailModal.classList.add('active');
  }

  function closeProjectDetail() {
    projectDetailModal.classList.remove('active');
  }
  projDetailClose.addEventListener('click', closeProjectDetail);
  projDetailBtnClose.addEventListener('click', closeProjectDetail);

  // ----------------------------------------------------
  // بوابة الطالب - المنطق والـ APIs
  // ----------------------------------------------------
  function showPortalPanel(panel) {
    const discountNotice = document.getElementById('new-request-discount-notice');
    const discountVal = document.getElementById('request-discount-val');

    // إزالة التنشيط عن التبويبات
    menuMyDashboard.classList.remove('active');
    menuMyRequests.classList.remove('active');
    menuNewRequest.classList.remove('active');

    // إخفاء جميع اللوحات
    portalDashboardPanel.classList.add('hidden');
    portalRequestsPanel.classList.add('hidden');
    portalNewRequestPanel.classList.add('hidden');

    if (panel === 'dashboard') {
      menuMyDashboard.classList.add('active');
      portalDashboardPanel.classList.remove('hidden');
      updateDashboardStats();
    } else if (panel === 'requests') {
      menuMyRequests.classList.add('active');
      portalRequestsPanel.classList.remove('hidden');
    } else {
      menuNewRequest.classList.add('active');
      portalNewRequestPanel.classList.remove('hidden');

      // إظهار وإعداد إشعار الخصم الخاص
      if (discountNotice && discountVal) {
        if (currentUser.discountPercent && currentUser.discountPercent > 0) {
          discountVal.innerText = currentUser.discountPercent;
          discountNotice.classList.remove('hidden');
        } else {
          discountNotice.classList.add('hidden');
        }
      }
    }
  }

  menuMyDashboard.addEventListener('click', () => showPortalPanel('dashboard'));
  menuMyRequests.addEventListener('click', () => showPortalPanel('requests'));
  menuNewRequest.addEventListener('click', () => showPortalPanel('new-request'));

  async function loadPortalData() {
    if (!currentUser) return;
    
    try {
      // جلب بيانات الطالب المحدثة للتأكد من المزامنة اللحظية للخصومات
      const resUser = await fetch(`/api/users/${currentUser.id}`);
      if (resUser.ok) {
        const freshUser = await resUser.json();
        currentUser = freshUser;
        localStorage.setItem('currentUser', JSON.stringify(freshUser));
      }
    } catch (err) {
      console.error('Error fetching fresh user privileges:', err);
    }

    // تفعيل الثيم الذهبي الفخم في حال كان الخصم 100% (على كامل الصفحة)
    if (currentUser && Number(currentUser.discountPercent) === 100) {
      document.body.classList.add('gold-theme');
    } else {
      document.body.classList.remove('gold-theme');
    }

    // تعبئة بيانات البروفايل الجانبي والداشبورد
    document.getElementById('portal-user-name').innerText = currentUser.name;
    document.getElementById('portal-user-major').innerText = `${currentUser.university} - ${currentUser.major}`;

    // تحديث الصور الشخصية (الأفاتار)
    updateAvatarPreviews();

    // تعبئة حقول تعديل الملف الشخصي بالبيانات الحالية
    const profName = document.getElementById('profile-name');
    const profPhone = document.getElementById('profile-phone');
    const profUni = document.getElementById('profile-university');
    const profMajor = document.getElementById('profile-major');
    const profPassword = document.getElementById('profile-password');
    
    if (profName) profName.value = currentUser.name;
    if (profPhone) profPhone.value = currentUser.phone || '';
    if (profUni) profUni.value = currentUser.university || '';
    if (profMajor) profMajor.value = currentUser.major || '';
    if (profPassword) profPassword.value = '';

    // تحديث إحصائيات الداشبورد
    updateDashboardStats();

    // تفريغ أعضاء المشروع الإضافيين وإبقاء الأول فقط مع ملء اسمه تلقائياً
    const wrapper = document.getElementById('members-list-wrapper');
    if (wrapper) {
      const rows = wrapper.querySelectorAll('.member-row');
      rows.forEach((r, idx) => {
        if (idx > 0) r.remove();
      });
      const firstNameInput = wrapper.querySelector('.member-name');
      const firstIdInput = wrapper.querySelector('.member-id');
      if (firstNameInput) {
        firstNameInput.value = currentUser.name;
      }
      if (firstIdInput) {
        firstIdInput.value = '';
      }
    }

    // إدارة وتصيير كارت الامتيازات والعروض
    const privilegesCard = document.getElementById('portal-user-privileges');
    const discountBadge = document.getElementById('portal-discount-badge');
    const offerText = document.getElementById('portal-offer-text');

    if (privilegesCard && discountBadge && offerText) {
      let hasPrivileges = false;

      if (currentUser.discountPercent && currentUser.discountPercent > 0) {
        discountBadge.innerText = `🔥 خصم حسابك الخاص: ${currentUser.discountPercent}%`;
        discountBadge.classList.remove('hidden');
        hasPrivileges = true;
      } else {
        discountBadge.classList.add('hidden');
      }

      if (currentUser.specialOffer && currentUser.specialOffer.trim() !== '') {
        offerText.innerText = currentUser.specialOffer;
        offerText.classList.remove('hidden');
        hasPrivileges = true;
      } else {
        offerText.classList.add('hidden');
      }

      if (hasPrivileges) {
        privilegesCard.classList.remove('hidden');
      } else {
        privilegesCard.classList.add('hidden');
      }
    }

    fetchStudentRequests();
  }

  async function fetchStudentRequests() {
    try {
      const response = await fetch(`/api/requests?studentId=${currentUser.id}`);
      const requests = await response.json();
      renderStudentRequests(requests);
    } catch (err) {
      console.error(err);
    }
  }

  function renderStudentRequests(requests) {
    studentRequestsTableBody.innerHTML = '';
    if (requests.length === 0) {
      studentRequestsTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">لا توجد طلبات جارية لك حالياً. اضغط على "طلب مشروع جديد" للبدء.</td></tr>`;
      return;
    }

    requests.forEach(r => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(r.createdAt).toLocaleDateString('ar-EG');
      const priceText = r.price > 0 ? `${r.price} EGP` : 'يحدد لاحقاً';
      
      tr.innerHTML = `
        <td style="font-weight: 600;">${r.title}</td>
        <td>${formattedDate}</td>
        <td style="font-family: 'Orbitron', sans-serif;">${priceText}</td>
        <td><span class="badge ${getBadgeClass(r.status)}">${getStatusLabel(r.status)}</span></td>
        <td>
          <button class="btn btn-outline btn-xs btn-track-order" data-id="${r.id}">
            تتبع واستلام <i class="fa-solid fa-arrows-spin"></i>
          </button>
        </td>
      `;
      studentRequestsTableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-track-order').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openOrderStatusModal(id);
      });
    });
  }

  function getBadgeClass(status) {
    const classes = {
      pending: 'badge-pending',
      accepted: 'badge-accepted',
      in_progress: 'badge-progress',
      ready_payment: 'badge-ready-payment',
      ready_payment_verify: 'badge-verify',
      paid: 'badge-progress',
      completed: 'badge-completed'
    };
    return classes[status] || 'badge-pending';
  }

  function getStatusLabel(status) {
    const labels = {
      pending: 'قيد المراجعة الفنية',
      accepted: 'تم القبول والتسعير',
      in_progress: 'جاري العمل والتنفيذ',
      ready_payment: 'جاهز (في انتظار الدفع)',
      ready_payment_verify: 'جاري تأكيد التحويل',
      paid: 'تم تأكيد الدفع وجاري الرفع',
      completed: 'تم التسليم بنجاح'
    };
    return labels[status] || status;
  }

  // تقديم طلب مشروع جديد
  newRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('req-title').value;
    const category = document.getElementById('req-category').value;
    const college = document.getElementById('req-college').value;
    const description = document.getElementById('req-description').value;
    const techNeeded = document.getElementById('req-tech').value;
    const deadline = document.getElementById('req-deadline').value;
    const fileInput = document.getElementById('req-file');

    // تجميع أسماء وأرقام أعضاء المشروع بالكامل
    const memberRows = document.querySelectorAll('#members-list-wrapper .member-row');
    const members = [];
    memberRows.forEach(row => {
      const nameInput = row.querySelector('.member-name');
      const idInput = row.querySelector('.member-id');
      if (nameInput && idInput && nameInput.value.trim() !== '') {
        members.push(`${nameInput.value.trim()} (${idInput.value.trim()})`);
      }
    });
    const combinedStudentNames = members.join(' - ');

    const formData = new FormData();
    formData.append('studentId', currentUser.id);
    formData.append('studentName', combinedStudentNames);
    formData.append('title', title);
    formData.append('category', category);
    formData.append('college', college);
    formData.append('description', description);
    formData.append('techNeeded', techNeeded);
    formData.append('deadline', deadline);
    if (fileInput.files.length > 0) {
      formData.append('attachment', fileInput.files[0]);
    }

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء إرسال الطلب');
        return;
      }

      const notifyWhatsApp = confirm('تم تقديم طلب مشروعك الجديد بنجاح! 🎉\n\nهل ترغب في تأكيد الطلب فوراً مع المطور عبد الله هيثم عبر الواتساب لتسريع المراجعة والتسعير؟');
      newRequestForm.reset();
      showPortalPanel('requests');
      fetchStudentRequests();

      if (notifyWhatsApp) {
        const orderId = data.id || '';
        const whatsappMsg = `مرحباً باشمهندس عبد الله، لقد قدمت طلب مشروع جديد على الموقع:\n\n- عنوان المشروع: ${data.title}\n- القسم: ${data.category}\n- الكلية والجامعة: ${data.college}\n- كود الطلب: ${orderId}\n\nيرجى مراجعته وتحديد السعر. شكراً لك!`;
        const whatsappUrl = `https://wa.me/201014054673?text=${encodeURIComponent(whatsappMsg)}`;
        window.open(whatsappUrl, '_blank');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // ----------------------------------------------------
  // تتبع الطلب وتطبيق بوابة الدفع والتسليم للطلاب
  // ----------------------------------------------------
  async function openOrderStatusModal(id) {
    activeTrackedOrderId = id;
    try {
      const response = await fetch(`/api/requests?studentId=${currentUser.id}`);
      const requests = await response.json();
      const order = requests.find(r => r.id === id);
      
      if (!order) return;

      orderTitleModal.innerText = order.title;
      
      // تحديث خط السير (Stepper)
      updateStepperUI(order.status);

      // إخفاء كل أقسام تفاصيل الحالة أولاً
      orderPendingReviewInfo.classList.add('hidden');
      paymentPricingInfo.classList.add('hidden');
      paymentInstructions.classList.add('hidden');
      paymentVerifyPending.classList.add('hidden');
      deliveryDownloadInfo.classList.add('hidden');

      if (order.status === 'pending') {
        orderPendingReviewInfo.classList.remove('hidden');
      } else if (order.status === 'accepted') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerText = `${order.price} EGP`;
      } else if (order.status === 'in_progress' || order.status === 'paid') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerText = `${order.price} EGP`;
        paymentVerifyPending.classList.remove('hidden');
        paymentVerifyPending.innerHTML = `
          <i class="fa-solid fa-gears fa-spin" style="font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--primary-cyan);"></i>
          <p style="font-weight: 700; color: var(--text-primary);">تم تأكيد الطلب وهو قيد التنفيذ والبرمجة حالياً بمتابعة مستمرة!</p>
        `;
      } else if (order.status === 'ready_payment') {
        paymentPricingInfo.classList.remove('hidden');
        paymentInstructions.classList.remove('hidden');
        orderPriceDisplay.innerText = `${order.price} EGP`;
      } else if (order.status === 'ready_payment_verify') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerText = `${order.price} EGP`;
        paymentVerifyPending.classList.remove('hidden');
        paymentVerifyPending.innerHTML = `
          <i class="fa-solid fa-hourglass-half fa-spin" style="font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--accent-gold);"></i>
          <p style="font-weight: 700;">تم إرسال التحويل الافتراضي! في انتظار تأكيد الأدمن لتفعيل خيار التحميل للبروجيكت.</p>
        `;
      } else if (order.status === 'completed') {
        deliveryDownloadInfo.classList.remove('hidden');
        btnDownloadProjectFiles.setAttribute('href', order.deliveryFile);
        if (order.deliveryFile.startsWith('http://') || order.deliveryFile.startsWith('https://')) {
          btnDownloadProjectFiles.setAttribute('target', '_blank');
          btnDownloadProjectFiles.removeAttribute('download');
          btnDownloadProjectFiles.innerHTML = 'فتح رابط المشروع المستلم <i class="fa-solid fa-arrow-up-right-from-square"></i>';
        } else {
          btnDownloadProjectFiles.setAttribute('download', '');
          btnDownloadProjectFiles.removeAttribute('target');
          btnDownloadProjectFiles.innerHTML = 'تحميل ملفات المشروع (Zip/PDF/Word) <i class="fa-solid fa-circle-down"></i>';
        }

        // تهيئة وعرض قسم التقييم
        const ratingSection = document.getElementById('rating-section');
        const ratingSuccessMsg = document.getElementById('rating-success-message');
        if (order.rating) {
          ratingSection.classList.add('hidden');
          ratingSuccessMsg.classList.remove('hidden');
          ratingSuccessMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> لقد قمت بتقييم جودة الخدمة بـ <strong>${order.rating} من 5 نجوم</strong>. شكراً لمشاركتنا رأيك!`;
        } else {
          ratingSection.classList.remove('hidden');
          ratingSuccessMsg.classList.add('hidden');
          selectedRating = 0;
          highlightStars(0);
          document.getElementById('rating-comment').value = '';
        }
      }

      orderStatusModal.classList.add('active');
    } catch (err) {
      console.error(err);
    }
  }

  function updateStepperUI(status) {
    // رتبة الحالات:
    // 1. pending (طلب استلم)
    // 2. accepted / in_progress (تم التسعير + قيد التنفيذ)
    // 3. ready_payment / ready_payment_verify (جاهز للدفع)
    // 4. paid (تم الدفع)
    // 5. completed (تم التسليم)

    // إزالة التنسيقات القديمة
    for (let i = 1; i <= 5; i++) {
      const step = document.getElementById(`step-${i}`);
      step.classList.remove('active', 'completed');
    }

    if (status === 'pending') {
      document.getElementById('step-1').classList.add('active');
    } else if (status === 'accepted') {
      document.getElementById('step-1').classList.add('completed');
      document.getElementById('step-2').classList.add('active');
    } else if (status === 'in_progress') {
      document.getElementById('step-1').classList.add('completed');
      document.getElementById('step-2').classList.add('completed');
      document.getElementById('step-3').classList.add('active');
    } else if (status === 'ready_payment' || status === 'ready_payment_verify') {
      document.getElementById('step-1').classList.add('completed');
      document.getElementById('step-2').classList.add('completed');
      document.getElementById('step-3').classList.add('completed');
      document.getElementById('step-4').classList.add('active');
    } else if (status === 'paid') {
      document.getElementById('step-1').classList.add('completed');
      document.getElementById('step-2').classList.add('completed');
      document.getElementById('step-3').classList.add('completed');
      document.getElementById('step-4').classList.add('completed');
      document.getElementById('step-5').classList.add('active');
    } else if (status === 'completed') {
      for (let i = 1; i <= 5; i++) {
        document.getElementById(`step-${i}`).classList.add('completed');
      }
    }
  }

  // تسليم إثبات الدفع
  paymentSubmissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paymentMethod = document.getElementById('pay-method').value;
    const transactionId = document.getElementById('pay-transaction-id').value;

    try {
      const response = await fetch(`/api/requests/${activeTrackedOrderId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, transactionId })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء رفع الدفع');
        return;
      }

      alert('تم إرسال إثبات الدفع بنجاح! سيقوم الأدمن بمراجعته الآن وسيتم فتح التحميل فوراً.');
      paymentSubmissionForm.reset();
      orderStatusModal.classList.remove('active');
      fetchStudentRequests();
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  orderStatusClose.addEventListener('click', () => {
    orderStatusModal.classList.remove('active');
  });

  // ----------------------------------------------------
  // تأثيرات العدادات الحركية بالإحصائيات (Stats)
  // ----------------------------------------------------
  let countersAnimated = false;
  function animateCounters() {
    if (countersAnimated) return;
    const counters = document.querySelectorAll('.stat-number');
    
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      const duration = 2000; // 2 ثانية للحركة
      const increment = target / (duration / 16); // 60 FPS تقريباً

      let current = 0;
      const updateCount = () => {
        current += increment;
        if (current < target) {
          counter.innerText = Math.ceil(current);
          setTimeout(updateCount, 16);
        } else {
          counter.innerText = target + (counter.parentElement.innerText.includes('%') ? '%' : '+');
        }
      };
      updateCount();
    });
    countersAnimated = true;
  }

  // دالة نسخ أرقام الحسابات
  window.copyPaymentNumber = function(number, element) {
    navigator.clipboard.writeText(number).then(() => {
      const span = element.querySelector('span');
      const originalText = span.innerHTML;
      span.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i> تم النسخ!';
      setTimeout(() => {
        span.innerHTML = originalText;
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  // ----------------------------------------------------
  // نظام تقييم الخدمة للطلاب (تفاعل النجوم والإرسال)
  // ----------------------------------------------------
  let selectedRating = 0;
  const starBtns = document.querySelectorAll('.star-btn');
  const btnSubmitRating = document.getElementById('btn-submit-rating');
  const ratingCommentInput = document.getElementById('rating-comment');

  starBtns.forEach(star => {
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.getAttribute('data-value'));
      highlightStars(selectedRating);
    });
    star.addEventListener('mouseenter', () => {
      const hoverValue = parseInt(star.getAttribute('data-value'));
      highlightStars(hoverValue);
    });
    star.addEventListener('mouseleave', () => {
      highlightStars(selectedRating);
    });
  });

  function highlightStars(value) {
    starBtns.forEach(star => {
      const starValue = parseInt(star.getAttribute('data-value'));
      if (starValue <= value) {
        star.classList.remove('fa-regular');
        star.classList.add('fa-solid');
      } else {
        star.classList.remove('fa-solid');
        star.classList.add('fa-regular');
      }
    });
  }

  // جعل دالة تلوين النجوم متاحة للمودال
  window.highlightStars = highlightStars;

  if (btnSubmitRating) {
    btnSubmitRating.addEventListener('click', async () => {
      if (selectedRating === 0) {
        alert('من فضلك اختر عدد النجوم للتقييم أولاً');
        return;
      }
      
      const ratingComment = ratingCommentInput.value.trim();
      
      try {
        const response = await fetch(`/api/requests/${activeTrackedOrderId}/rate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating: selectedRating, ratingComment })
        });
        const data = await response.json();
        
        if (!response.ok) {
          alert(data.error || 'حدث خطأ أثناء إرسال التقييم');
          return;
        }
        
        // إخفاء المدخلات وإظهار رسالة شكر للتقييم
        document.getElementById('rating-section').classList.add('hidden');
        const ratingSuccessMsg = document.getElementById('rating-success-message');
        ratingSuccessMsg.classList.remove('hidden');
        ratingSuccessMsg.innerHTML = `<i class="fa-solid fa-circle-check"></i> تم إرسال تقييمك بنجاح بـ <strong>${selectedRating} نجوم</strong>. شكراً لمشاركتنا رأيك!`;
        
        // تحديث البيانات والقائمة وإعادة حساب الإحصائيات
        fetchStudentRequests();
        loadDynamicStats();
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

  // جلب الإحصائيات الديناميكية لتحديث العدادات
  async function loadDynamicStats() {
    try {
      const response = await fetch('/api/stats');
      if (!response.ok) return;
      const stats = await response.json();
      
      const counters = document.querySelectorAll('.stat-number');
      // الأول هو المشاريع المنجزة (مثلاً 300)
      if (counters[0] && stats.completedCount) {
        counters[0].setAttribute('data-target', stats.completedCount);
      }
      // الأخير هو نسبة الرضا (الرابع)
      if (counters[3] && stats.satisfactionRate) {
        counters[3].setAttribute('data-target', stats.satisfactionRate);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  // ----------------------------------------------------
  // أزرار التحكم بصورة تفاصيل المشروع
  // ----------------------------------------------------
  const btnToggleFit = document.getElementById('btn-toggle-fit');
  const btnViewFull = document.getElementById('btn-view-full');
  const detailImgEl = document.getElementById('proj-detail-image');

  if (btnToggleFit && detailImgEl) {
    btnToggleFit.addEventListener('click', () => {
      if (detailImgEl.style.objectFit === 'contain') {
        detailImgEl.style.objectFit = 'cover';
        btnToggleFit.innerHTML = '<i class="fa-solid fa-compress"></i> احتواء الصورة';
      } else {
        detailImgEl.style.objectFit = 'contain';
        btnToggleFit.innerHTML = '<i class="fa-solid fa-expand"></i> تمديد الصورة';
      }
    });
  }

  if (btnViewFull && detailImgEl) {
    btnViewFull.addEventListener('click', () => {
      if (detailImgEl.src) {
        window.open(detailImgEl.src, '_blank');
      }
    });
  }

  // ----------------------------------------------------
  // أزرار الإضافة السريعة للتقنيات والمستشعرات
  // ----------------------------------------------------
  const reqTechInput = document.getElementById('req-tech');
  document.querySelectorAll('.btn-tech-suggest').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tech = e.currentTarget.getAttribute('data-tech');
      let currentVal = reqTechInput.value.trim();
      if (currentVal === '') {
        reqTechInput.value = tech;
      } else {
        const tags = currentVal.split(',').map(t => t.trim());
        if (!tags.includes(tech)) {
          reqTechInput.value = currentVal + ', ' + tech;
        }
      }
    });
  });

  // ----------------------------------------------------
  // إضافة أعضاء مشروع ديناميكي للطلاب
  // ----------------------------------------------------
  const btnAddMember = document.getElementById('btn-add-member');
  const membersListWrapper = document.getElementById('members-list-wrapper');

  if (btnAddMember && membersListWrapper) {
    btnAddMember.addEventListener('click', () => {
      const row = document.createElement('div');
      row.className = 'member-row';
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr 1fr auto';
      row.style.gap = '0.8rem';
      row.style.marginBottom = '0.6rem';
      row.style.alignItems = 'center';

      row.innerHTML = `
        <input type="text" class="form-control member-name" placeholder="اسم العضو الإضافي" required style="margin-bottom: 0;">
        <input type="text" class="form-control member-id" placeholder="الرقم الجامعي (ID)" required style="margin-bottom: 0;">
        <button type="button" class="btn-remove-member" style="background: none; border: none; color: var(--secondary-magenta); cursor: pointer; font-size: 1.5rem; padding: 0.2rem; line-height: 1;" title="حذف العضو">&times;</button>
      `;

      // ربط إجراء الحذف
      row.querySelector('.btn-remove-member').addEventListener('click', () => {
        row.remove();
      });

      membersListWrapper.appendChild(row);
    });
  }

  // ----------------------------------------------------
  // بدء تشغيل الصفحة والتهيئة الأساسية
  // ربط النقر على اللوجو للانتقال لمعرض المشاريع مباشرة
  const logoContainerTrigger = document.getElementById('logo-container-trigger');
  if (logoContainerTrigger) {
    logoContainerTrigger.addEventListener('click', () => {
      showSection('landing');
      const showcaseSec = document.getElementById('showcase-section');
      if (showcaseSec) {
        showcaseSec.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }

  function updateAvatarPreviews() {
    const sidebarAvatar = document.getElementById('portal-user-avatar');
    const editAvatarPreview = document.getElementById('profile-edit-avatar-preview');
    
    if (currentUser.profileImage) {
      if (sidebarAvatar) {
        sidebarAvatar.style.backgroundImage = `url(${currentUser.profileImage})`;
        sidebarAvatar.innerText = '';
      }
      if (editAvatarPreview) {
        editAvatarPreview.style.backgroundImage = `url(${currentUser.profileImage})`;
        editAvatarPreview.innerText = '';
      }
    } else {
      const letter = currentUser.name.charAt(0).toUpperCase();
      if (sidebarAvatar) {
        sidebarAvatar.style.backgroundImage = 'none';
        sidebarAvatar.innerText = letter;
      }
      if (editAvatarPreview) {
        editAvatarPreview.style.backgroundImage = 'none';
        editAvatarPreview.innerText = letter;
      }
    }
  }

  async function updateDashboardStats() {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/requests?studentId=${currentUser.id}`);
      if (!response.ok) return;
      const requests = await response.json();

      const totalRequests = requests.length;
      const completedRequests = requests.filter(r => r.status === 'completed').length;
      const totalSpent = requests
        .filter(r => r.status === 'completed' || r.status === 'paid')
        .reduce((sum, r) => sum + r.price, 0);

      document.getElementById('student-stat-total-requests').innerText = totalRequests;
      document.getElementById('student-stat-completed').innerText = completedRequests;
      document.getElementById('student-stat-total-spent').innerText = totalSpent + ' EGP';
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
    }
  }

  const profileAvatarInput = document.getElementById('profile-avatar-input');
  if (profileAvatarInput) {
    profileAvatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const editAvatarPreview = document.getElementById('profile-edit-avatar-preview');
          if (editAvatarPreview) {
            editAvatarPreview.style.backgroundImage = `url(${event.target.result})`;
            editAvatarPreview.innerText = '';
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const studentUpdateProfileForm = document.getElementById('student-update-profile-form');
  if (studentUpdateProfileForm) {
    studentUpdateProfileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('profile-name').value;
      const phone = document.getElementById('profile-phone').value;
      const university = document.getElementById('profile-university').value;
      const major = document.getElementById('profile-major').value;
      const password = document.getElementById('profile-password').value;
      const avatarFile = profileAvatarInput ? profileAvatarInput.files[0] : null;

      const formData = new FormData();
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('university', university);
      formData.append('major', major);
      if (password && password.trim() !== '') {
        formData.append('password', password);
      }
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      try {
        const response = await fetch(`/api/students/${currentUser.id}/profile`, {
          method: 'PUT',
          body: formData
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'حدث خطأ أثناء تعديل بيانات الحساب');
          return;
        }

        currentUser = data;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        updateAuthUI();
        loadPortalData();
        
        alert('تم حفظ تعديلات حسابك بنجاح! 🚀');
      } catch (err) {
        console.error('Error updating profile:', err);
        alert('خطأ في الاتصال بالخادم أثناء حفظ التعديلات');
      }
    });
  }

  // ----------------------------------------------------
  updateAuthUI();
  fetchCategories().then(() => {
    fetchArchiveProjects();
  });
  
  // تحميل الإحصائيات ديناميكياً ثم بدء حركة الأرقام
  loadDynamicStats().then(() => {
    setTimeout(animateCounters, 300);
  });
});
