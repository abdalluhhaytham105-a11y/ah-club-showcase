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
  let activeDetailProjectId = null;
  let pollingStarted = false;

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
  const orderCancelledInfo = document.getElementById('order-cancelled-info');
  const orderCancelReasonDisplay = document.getElementById('order-cancel-reason-display');
  const paymentSubmissionForm = document.getElementById('payment-submission-form');
  const btnDownloadProjectFiles = document.getElementById('btn-download-project-files');

  let activeTrackedOrderId = null;

  // ----------------------------------------------------
  // تهيئة وتنسيق الدخول
  // ----------------------------------------------------
  function updateAuthUI() {
    const mobileLoggedInControls = document.getElementById('mobile-logged-in-controls');
    const mobileNavAdmin = document.getElementById('mobile-nav-admin');

    if (currentUser) {
      authButtonsContainer.classList.add('hidden');
      userProfileContainer.classList.remove('hidden');
      userWelcomeMsg.innerHTML = `<i class="fa-solid fa-user-astronaut"></i> مرحباً، ${currentUser.name.split(' ')[0]}`;
      navPortal.classList.remove('hidden');
      document.body.classList.add('user-logged-in');
      if (mobileLoggedInControls) mobileLoggedInControls.classList.remove('hidden');
      
      if (currentUser.role === 'admin') {
        navAdmin.classList.remove('hidden');
        if (mobileNavAdmin) mobileNavAdmin.classList.remove('hidden');
      } else {
        navAdmin.classList.add('hidden');
        if (mobileNavAdmin) mobileNavAdmin.classList.add('hidden');
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
      document.body.classList.remove('user-logged-in');
      if (mobileLoggedInControls) mobileLoggedInControls.classList.add('hidden');
      showSection('landing');
      document.body.classList.remove('gold-theme');
    }
  }

  function showSection(section) {
    const mobHome = document.getElementById('mobile-nav-home');
    const mobPortal = document.getElementById('mobile-nav-portal');

    if (section === 'landing') {
      landingView.classList.remove('hidden');
      studentPortalView.classList.add('hidden');
      navHome.classList.add('active');
      navPortal.classList.remove('active');
      if (mobHome) mobHome.classList.add('active');
      if (mobPortal) mobPortal.classList.remove('active');
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
      if (mobHome) mobHome.classList.remove('active');
      if (mobPortal) mobPortal.classList.add('active');
      loadPortalData();
    }
  }

  // التنقل بين الأقسام
  navHome.addEventListener('click', (e) => { e.preventDefault(); showSection('landing'); });
  navPortal.addEventListener('click', (e) => { e.preventDefault(); showSection('portal'); });

  // مستمعات النقر لأيقونات الموبايل الدائرية
  const mobHomeBtn = document.getElementById('mobile-nav-home');
  const mobPortalBtn = document.getElementById('mobile-nav-portal');
  const mobToggleModeBtn = document.getElementById('mobile-btn-toggle-dark-mode');
  const mobLogoutBtn = document.getElementById('mobile-btn-logout');

  if (mobHomeBtn) mobHomeBtn.addEventListener('click', () => showSection('landing'));
  if (mobPortalBtn) mobPortalBtn.addEventListener('click', () => showSection('portal'));
  if (mobToggleModeBtn) {
    mobToggleModeBtn.addEventListener('click', () => {
      const desktopBtn = document.getElementById('btn-toggle-dark-mode');
      if (desktopBtn) desktopBtn.click();
    });
  }
  if (mobLogoutBtn) {
    mobLogoutBtn.addEventListener('click', () => {
      const desktopLogout = document.getElementById('btn-logout');
      if (desktopLogout) desktopLogout.click();
    });
  }

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
    const reqCollegeSelect = document.getElementById('req-college');
    if (reqCollegeSelect) {
      reqCollegeSelect.innerHTML = '';
      categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.label; // Use label for college name directly
        opt.innerText = c.label;
        reqCollegeSelect.appendChild(opt);
      });
      const optOther = document.createElement('option');
      optOther.value = 'أخرى';
      optOther.innerText = 'كلية أخرى / تخصص آخر';
      reqCollegeSelect.appendChild(optOther);
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
    activeDetailProjectId = id;

    // إعادة تهيئة قسم تقييم المعرض
    selectedShowcaseRating = 0;
    highlightShowcaseStars(0);
    const commentInput = document.getElementById('showcase-rating-comment');
    const nameInput = document.getElementById('showcase-visitor-name');
    const emailInput = document.getElementById('showcase-visitor-email');
    const submitBtn = document.getElementById('btn-submit-showcase-rating');
    const feedbackDiv = document.getElementById('showcase-rating-feedback');
    if (commentInput) {
      commentInput.value = '';
      commentInput.disabled = false;
    }
    if (nameInput) {
      nameInput.value = currentUser ? currentUser.name : '';
      nameInput.disabled = false;
    }
    if (emailInput) {
      emailInput.value = currentUser ? currentUser.email : '';
      emailInput.disabled = false;
    }
    if (submitBtn) submitBtn.style.display = 'block';
    if (feedbackDiv) {
      feedbackDiv.innerText = '';
      feedbackDiv.classList.add('hidden');
    }

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
    
    // بدء الفحص الدوري لحالة الطلبات للطلاب
    if (!pollingStarted) {
      pollingStarted = true;
      initializeOrdersState().then(() => {
        startOrderStatePolling();
      });
    }

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

  // ----------------------------------------------------


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
      completed: 'badge-completed',
      cancelled: 'badge-cancelled'
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
      completed: 'تم التسليم بنجاح',
      cancelled: 'تم إلغاء الطلب'
    };
    return labels[status] || status;
  }

  // تقديم طلب مشروع جديد
  newRequestForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('req-title').value;
    const college = document.getElementById('req-college').value;
    const university = document.getElementById('req-university').value;
    const deliveryFormat = document.getElementById('req-delivery-format').value;
    const slideCount = document.getElementById('req-slide-count').value;
    const hasData = document.getElementById('req-has-data').value;
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
    const teamSize = members.length;

    // استخراج السعر التقديري الفعلي من الشاشة
    const estPriceText = document.getElementById('est-price-display').innerText;
    const estimatedPrice = parseInt(estPriceText.replace(/\D/g, '')) || 0;

    const formData = new FormData();
    formData.append('studentId', currentUser.id);
    formData.append('studentName', combinedStudentNames);
    formData.append('studentPhone', currentUser.phone || '');
    formData.append('title', title);
    formData.append('college', college);
    formData.append('university', university);
    formData.append('deliveryFormat', deliveryFormat);
    formData.append('slideCount', slideCount);
    formData.append('teamSize', teamSize);
    formData.append('hasData', hasData);
    formData.append('estimatedPrice', estimatedPrice);
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
      
      // إخفاء حقل الشرائح وتصفية المدخلات الافتراضية
      if (reqSlideCountGroup) reqSlideCountGroup.style.display = 'none';
      if (reqFileLabel) reqFileLabel.innerHTML = 'تحميل ملف المادة العلمية أو الداتا الخاصة بك (PDF, Word, Zip) (مطلوب) 📸';
      
      showPortalPanel('requests');
      fetchStudentRequests();

      if (notifyWhatsApp) {
        const orderId = data.id || '';
        const whatsappMsg = `مرحباً باشمهندس عبد الله، لقد قدمت طلب مشروع جديد على الموقع:\n\n- عنوان المشروع: ${data.title}\n- الكلية: ${data.college}\n- الجامعة: ${data.university}\n- صيغة التسليم: ${data.deliveryFormat === 'word' ? 'Word' : data.deliveryFormat === 'ppt' ? 'PowerPoint' : 'Poster'}\n- كود الطلب: ${orderId}\n\nيرجى مراجعته وتحديد السعر. شكراً لك!`;
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
      if (orderCancelledInfo) orderCancelledInfo.classList.add('hidden');
      paymentPricingInfo.classList.add('hidden');
      paymentInstructions.classList.add('hidden');
      paymentVerifyPending.classList.add('hidden');
      deliveryDownloadInfo.classList.add('hidden');

      // حساب الخصم وعرض السعر
      let finalPrice = order.price;
      let discountMarkup = '';
      if (currentUser && currentUser.discountPercent && order.price > 0) {
        const discountAmount = Math.round(order.price * (currentUser.discountPercent / 100));
        finalPrice = order.price - discountAmount;
        discountMarkup = `
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem; text-align: right;">
            <span style="text-decoration: line-through; color: var(--text-muted);">${order.price} EGP</span>
            <span style="color: #ff5555; margin-right: 0.5rem;">(خصم ${currentUser.discountPercent}%)</span>
          </div>
        `;
      }

      const isFreeOrder = finalPrice === 0;
      const freeConfirmSection = document.getElementById('free-confirm-section');

      if (order.status === 'pending') {
        orderPendingReviewInfo.classList.remove('hidden');
        if (freeConfirmSection) freeConfirmSection.classList.add('hidden');
      } else if (order.status === 'accepted') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerHTML = `${finalPrice} EGP ${discountMarkup}`;
        
        if (isFreeOrder) {
          if (paymentInstructions) paymentInstructions.classList.add('hidden');
          if (freeConfirmSection) freeConfirmSection.classList.remove('hidden');
        } else {
          if (paymentInstructions) paymentInstructions.classList.remove('hidden');
          if (freeConfirmSection) freeConfirmSection.classList.add('hidden');
        }
      } else if (order.status === 'in_progress' || order.status === 'paid') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerHTML = `${finalPrice} EGP ${discountMarkup}`;
        paymentVerifyPending.classList.remove('hidden');
        if (freeConfirmSection) freeConfirmSection.classList.add('hidden');
        paymentVerifyPending.innerHTML = `
          <i class="fa-solid fa-gears fa-spin" style="font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--primary-cyan);"></i>
          <p style="font-weight: 700; color: var(--text-primary);">تم تأكيد الطلب وهو قيد التنفيذ والبرمجة حالياً بمتابعة مستمرة!</p>
        `;
      } else if (order.status === 'ready_payment') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerHTML = `${finalPrice} EGP ${discountMarkup}`;

        if (isFreeOrder) {
          if (paymentInstructions) paymentInstructions.classList.add('hidden');
          if (freeConfirmSection) freeConfirmSection.classList.remove('hidden');
        } else {
          if (paymentInstructions) paymentInstructions.classList.remove('hidden');
          if (freeConfirmSection) freeConfirmSection.classList.add('hidden');
        }
      } else if (order.status === 'ready_payment_verify') {
        paymentPricingInfo.classList.remove('hidden');
        orderPriceDisplay.innerHTML = `${finalPrice} EGP ${discountMarkup}`;
        paymentVerifyPending.classList.remove('hidden');
        if (freeConfirmSection) freeConfirmSection.classList.add('hidden');
        paymentVerifyPending.innerHTML = `
          <i class="fa-solid fa-hourglass-half fa-spin" style="font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--accent-gold);"></i>
          <p style="font-weight: 700;">تم إرسال إثبات الدفع وسكرين التحويل! في انتظار تأكيد الأدمن لتفعيل خيار التحميل للبروجيكت.</p>
        `;
      } else if (order.status === 'cancelled') {
        if (orderCancelledInfo) orderCancelledInfo.classList.remove('hidden');
        if (orderCancelReasonDisplay) {
          orderCancelReasonDisplay.innerText = order.cancellationReason || 'لم يتم ذكر سبب محدد للطلب المرفوض.';
        }
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
    const screenshotInput = document.getElementById('pay-receipt-screenshot');

    try {
      // 1. رفع ملف لقطة شاشة التحويل أولاً إذا تم تحديده
      if (screenshotInput && screenshotInput.files.length > 0) {
        const fileFormData = new FormData();
        fileFormData.append('receipt', screenshotInput.files[0]);

        const receiptResponse = await fetch(`/api/requests/${activeTrackedOrderId}/payment-receipt`, {
          method: 'PUT',
          body: fileFormData
        });

        if (!receiptResponse.ok) {
          const receiptData = await receiptResponse.json();
          alert(receiptData.error || 'فشل رفع لقطة شاشة إثبات الدفع');
          return;
        }
      }

      // 2. إرسال تفاصيل المعاملة النصية
      const response = await fetch(`/api/requests/${activeTrackedOrderId}/pay`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod, transactionId })
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء إرسال تفاصيل الدفع');
        return;
      }

      alert('تم إرسال إثبات الدفع واللقطة بنجاح! سيقوم الأدمن بمراجعتها فوراً لبدء العمل.');
      paymentSubmissionForm.reset();
      orderStatusModal.classList.remove('active');
      fetchStudentRequests();
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // تأكيد الطلب المجاني (100% خصم)
  const btnConfirmFreeOrder = document.getElementById('btn-confirm-free-order');
  if (btnConfirmFreeOrder) {
    btnConfirmFreeOrder.addEventListener('click', async () => {
      try {
        const response = await fetch(`/api/requests/${activeTrackedOrderId}/confirm-free`, {
          method: 'PUT'
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'فشل تأكيد الطلب المجاني');
          return;
        }

        alert('تم تأكيد طلبك المجاني بنجاح! جاري العمل على مشروعك حالياً 🚀');
        orderStatusModal.classList.remove('active');
        fetchStudentRequests();
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

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

      // تحديث بنرات التنبيهات في بوابة الطالب
      const alertBannerContainer = document.getElementById('portal-alert-banner');
      if (alertBannerContainer) {
        alertBannerContainer.innerHTML = '';
        let hasAlerts = false;

        // استرجاع الإشعارات المغلقة يدوياً من الطالب
        const dismissedAlerts = JSON.parse(localStorage.getItem('dismissedAlerts') || '[]');

        requests.forEach(r => {
          // تخطي إذا تم إغلاق التنبيه يدوياً أو إذا كان مكتملاً أو ما زال معلقاً تحت المراجعة
          if (dismissedAlerts.includes(r.id)) return;
          if (r.status === 'completed' || r.status === 'pending') return;

          let cardClass = '';
          let icon = '';
          let text = '';
          let actionBtn = '';

          if (r.status === 'accepted' || r.status === 'ready_payment') {
            cardClass = 'alert-gold';
            icon = '<i class="fa-solid fa-circle-check" style="color: var(--accent-gold);"></i>';
            text = `تمت الموافقة والتسعير لطلبك <strong>"${r.title}"</strong> بقيمة <strong style="font-family: 'Orbitron';">${r.price} EGP</strong>.`;
            actionBtn = `<button class="btn btn-primary btn-xs" onclick="document.getElementById('menu-my-requests').click();" style="font-size:0.75rem; padding:0.3rem 0.6rem; font-family:'Cairo';">الذهاب للدفع ⚡</button>`;
            hasAlerts = true;
          } else if (r.status === 'in_progress' || r.status === 'ready_payment_verify' || r.status === 'paid') {
            cardClass = 'alert-blue';
            icon = '<i class="fa-solid fa-gears" style="color: var(--primary-cyan);"></i>';
            text = `طلبك لـ <strong>"${r.title}"</strong> مقبول وهو حالياً قيد العمل والبرمجة المستمرة ⚙️`;
            actionBtn = `<button class="btn btn-outline btn-xs" onclick="document.getElementById('menu-my-requests').click();" style="font-size:0.75rem; padding:0.3rem 0.6rem; font-family:'Cairo';">تتبع الخطوات 🔍</button>`;
            hasAlerts = true;
          } else if (r.status === 'cancelled') {
            cardClass = 'alert-red';
            icon = '<i class="fa-solid fa-circle-xmark" style="color: #ff5555;"></i>';
            text = `تم رفض وإلغاء طلبك لـ <strong>"${r.title}"</strong>. السبب: <span style="font-weight:700;">"${r.cancellationReason || 'لا يوجد سبب محدد'}"</span>`;
            hasAlerts = true;
          }

          if (cardClass) {
            const card = document.createElement('div');
            card.className = `portal-alert-card ${cardClass}`;
            card.style.position = 'relative';
            card.innerHTML = `
              <div class="portal-alert-info" style="padding-left: 1.5rem;">
                ${icon}
                <span style="margin-right: 0.5rem;">${text}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 0.8rem; margin-right: auto; padding-right: 1.5rem;">
                ${actionBtn}
                <button class="btn-close-alert" data-id="${r.id}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem; line-height:1;" title="إغلاق التنبيه">&times;</button>
              </div>
            `;
            alertBannerContainer.appendChild(card);
          }
        });

        // ربط أحداث الإغلاق اليدوي للتنبيهات
        document.querySelectorAll('.btn-close-alert').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const dismissed = JSON.parse(localStorage.getItem('dismissedAlerts') || '[]');
            if (!dismissed.includes(id)) {
              dismissed.push(id);
              localStorage.setItem('dismissedAlerts', JSON.stringify(dismissed));
            }
            // إعادة تحميل وتحديث الإحصائيات لإخفاء التنبيه فوراً
            updateDashboardStats();
          });
        });

        if (hasAlerts) {
          alertBannerContainer.classList.remove('hidden');
        } else {
          alertBannerContainer.classList.add('hidden');
        }
      }
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

  async function loadAnnouncements() {
    try {
      const response = await fetch('/api/announcements');
      if (!response.ok) return;
      const announcements = await response.json();

      const hubContainer = document.getElementById('announcements-hub-container');
      const listWrapper = document.getElementById('announcements-list-wrapper');

      if (!hubContainer || !listWrapper) return;

      if (announcements.length === 0) {
        hubContainer.classList.add('hidden');
        return;
      }

      hubContainer.classList.remove('hidden');
      listWrapper.innerHTML = '';

      announcements.forEach(ann => {
        const item = document.createElement('div');
        item.style.background = 'rgba(255, 255, 255, 0.015)';
        item.style.border = '1px solid rgba(255, 255, 255, 0.05)';
        item.style.padding = '1.2rem';
        item.style.borderRadius = '12px';
        item.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';

        const formattedDate = new Date(ann.createdAt).toLocaleDateString('ar-EG');

        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem;">
            <h4 style="font-weight: 700; color: var(--primary-cyan); font-size: 1rem; margin: 0;">${ann.title}</h4>
            <span style="font-size: 0.75rem; color: var(--text-secondary);"><i class="fa-regular fa-clock"></i> ${formattedDate}</span>
          </div>
          <p style="color: var(--text-secondary); line-height: 1.6; font-size: 0.85rem; margin: 0; white-space: pre-line;">${ann.content}</p>
        `;
        listWrapper.appendChild(item);
      });

      // عرض البوب اب لأول إعلان نشط لم يتم مشاهدته في هذه الجلسة
      const firstAnn = announcements[0];
      const seen = JSON.parse(sessionStorage.getItem('seenAnnouncements') || '[]');
      if (firstAnn && !seen.includes(firstAnn.id)) {
        const popupModal = document.getElementById('announcement-popup-modal');
        const popupTitle = document.getElementById('popup-announcement-title');
        const popupContent = document.getElementById('popup-announcement-content');
        const btnClosePopup = document.getElementById('btn-close-announcement-popup');
        const popupDiscountContainer = document.getElementById('popup-discount-container');
        const popupDiscountText = document.getElementById('popup-discount-text');
        const popupDiscountCodeBadge = document.getElementById('popup-discount-code-badge');
        const btnApplyPopupDiscount = document.getElementById('btn-apply-popup-discount');

        if (popupModal && popupTitle && popupContent && btnClosePopup) {
          popupTitle.innerText = firstAnn.title;
          popupContent.innerText = firstAnn.content;

          if (firstAnn.type === 'discount' && firstAnn.discountCode && firstAnn.discountPercent) {
            if (popupDiscountContainer && popupDiscountText && popupDiscountCodeBadge && btnApplyPopupDiscount) {
              popupDiscountText.innerText = `خصم ${firstAnn.discountPercent}% باستخدام كود الخصم`;
              popupDiscountCodeBadge.innerText = firstAnn.discountCode;
              popupDiscountContainer.classList.remove('hidden');

              btnApplyPopupDiscount.onclick = async () => {
                try {
                  const applyRes = await fetch('/api/promos/apply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: firstAnn.discountCode })
                  });
                  const applyData = await applyRes.json();
                  if (applyRes.ok) {
                    alert(applyData.message || 'تم تطبيق كود الخصم بنجاح! ⚡');
                    if (currentUser) {
                      currentUser.discountPercent = firstAnn.discountPercent;
                      currentUser.specialOffer = `خصم ${firstAnn.discountPercent}% باستخدام كود ${firstAnn.discountCode}`;
                      localStorage.setItem('currentUser', JSON.stringify(currentUser));
                      loadPortalData();
                    }
                    popupModal.classList.remove('active');
                    seen.push(firstAnn.id);
                    sessionStorage.setItem('seenAnnouncements', JSON.stringify(seen));
                  } else {
                    alert(applyData.error || 'فشل تطبيق الكود');
                  }
                } catch (e) {
                  console.error(e);
                  alert('خطأ في الاتصال بالخادم لتطبيق الخصم');
                }
              };
            }
          } else {
            if (popupDiscountContainer) popupDiscountContainer.classList.add('hidden');
          }

          popupModal.classList.add('active');

          btnClosePopup.onclick = () => {
            popupModal.classList.remove('active');
            seen.push(firstAnn.id);
            sessionStorage.setItem('seenAnnouncements', JSON.stringify(seen));
          };
        }
      }
    } catch (err) {
      console.error('Error loading announcements:', err);
    }
  }

  // ----------------------------------------------------
  // 6. الحاسبة التقديرية التفاعلية للمشاريع (المحدثة)
  // ----------------------------------------------------
  const estDeliveryFormat = document.getElementById('est-delivery-format');
  const estHasData = document.getElementById('est-has-data');
  const estSlideCountGroup = document.getElementById('est-slide-count-group');
  const estSlideCount = document.getElementById('est-slide-count');
  const estUrgencyHours = document.getElementById('est-urgency-hours');
  const estMembers = document.getElementById('est-members');
  const estMembersVal = document.getElementById('est-members-val');
  const estPriceDisplay = document.getElementById('est-price-display');

  // إظهار وإخفاء حقل عدد الشرائح بناءً على اختيار البوربوينت في الحاسبة
  if (estDeliveryFormat) {
    estDeliveryFormat.addEventListener('change', () => {
      if (estDeliveryFormat.value === 'ppt') {
        if (estSlideCountGroup) estSlideCountGroup.style.display = 'block';
      } else {
        if (estSlideCountGroup) estSlideCountGroup.style.display = 'none';
      }
      calculateEstimatedPrice();
    });
  }

  function calculateEstimatedPrice() {
    if (!estDeliveryFormat || !estHasData || !estMembers || !estPriceDisplay) return;

    const format = estDeliveryFormat.value;
    const hasData = estHasData.value === 'yes';
    const members = parseInt(estMembers.value);
    const urgency = estUrgencyHours ? estUrgencyHours.value : 'relaxed';

    if (estMembersVal) estMembersVal.innerText = members;

    let basePrice = 0;

    if (format === 'word') {
      basePrice = 100;
      if (!hasData) {
        basePrice += 75; // إضافة 75 للبحث عن الداتا
      }
    } else if (format === 'ppt') {
      const slides = estSlideCount ? parseInt(estSlideCount.value) || 10 : 10;
      const ratePerSlide = members > 1 ? 20 : 10; // 20 للتيمات، 10 للفردي
      basePrice = slides * ratePerSlide;
      if (!hasData) {
        basePrice += 75; // إضافة 75 للبحث عن الداتا
      }
    } else if (format === 'poster') {
      if (members > 3) {
        basePrice = hasData ? 150 : 200;
      } else {
        basePrice = hasData ? 120 : 170;
      }
    }

    // معامل الاستعجال
    let multiplier = 1.0;
    if (urgency === 'urgent10') multiplier = 1.25;
    if (urgency === 'urgent3') multiplier = 1.5;

    let totalPrice = Math.round(basePrice * multiplier);

    estPriceDisplay.innerText = `${totalPrice} EGP`;
  }

  if (estHasData) estHasData.addEventListener('change', calculateEstimatedPrice);
  if (estSlideCount) estSlideCount.addEventListener('input', calculateEstimatedPrice);
  if (estUrgencyHours) estUrgencyHours.addEventListener('change', calculateEstimatedPrice);
  if (estMembers) {
    estMembers.addEventListener('input', calculateEstimatedPrice);
    estMembers.addEventListener('change', calculateEstimatedPrice);
  }

  // تشغيل الحاسبة لأول مرة
  calculateEstimatedPrice();

  // ----------------------------------------------------
  // إخفاء وإظهار الحقول التفاعلية في استمارة الطلب الفعلية
  // ----------------------------------------------------
  const reqDeliveryFormat = document.getElementById('req-delivery-format');
  const reqSlideCountGroup = document.getElementById('req-slide-count-group');
  const reqSlideCount = document.getElementById('req-slide-count');
  const reqHasData = document.getElementById('req-has-data');
  const reqFileLabel = document.getElementById('req-file-label');
  const reqFile = document.getElementById('req-file');

  if (reqDeliveryFormat) {
    reqDeliveryFormat.addEventListener('change', () => {
      if (reqDeliveryFormat.value === 'ppt') {
        if (reqSlideCountGroup) reqSlideCountGroup.style.display = 'block';
        if (reqSlideCount) reqSlideCount.required = true;
      } else {
        if (reqSlideCountGroup) reqSlideCountGroup.style.display = 'none';
        if (reqSlideCount) reqSlideCount.required = false;
      }
    });
  }

  if (reqHasData) {
    reqHasData.addEventListener('change', () => {
      if (reqHasData.value === 'yes') {
        if (reqFileLabel) reqFileLabel.innerHTML = 'تحميل ملف المادة العلمية أو الداتا الخاصة بك (PDF, Word, Zip) (مطلوب) 📸';
        if (reqFile) reqFile.required = true;
      } else {
        if (reqFileLabel) reqFileLabel.innerHTML = 'تحميل ملف الإرشادات أو الـ Guideline للمطور (اختياري) 📂';
        if (reqFile) reqFile.required = false;
      }
    });
  }

  // منع اختيار ديدلاين قديم للطلب بالثانية والدقيقة
  const reqDeadline = document.getElementById('req-deadline');
  if (reqDeadline) {
    // تحديث دائم للحد الأدنى المسموح به ليكون اللحظة الحالية
    const updateMinDeadline = () => {
      const now = new Date();
      // تنسيق التوقيت المحلي ليتماشى مع datetime-local (YYYY-MM-DDTHH:MM)
      const tzOffset = now.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16);
      reqDeadline.min = localISOTime;
    };
    updateMinDeadline();
    reqDeadline.addEventListener('click', updateMinDeadline);
  }

  // ----------------------------------------------------
  // 7. تطبيق كود الخصم بداخل بوابة الطلبات
  // ----------------------------------------------------
  const reqPromoCodeInput = document.getElementById('req-promo-code');
  const btnApplyPromo = document.getElementById('btn-apply-promo');
  const promoStatusMsg = document.getElementById('promo-status-msg');
  let activeAppliedPromoCode = null;

  if (btnApplyPromo && reqPromoCodeInput && promoStatusMsg) {
    btnApplyPromo.addEventListener('click', async () => {
      const code = reqPromoCodeInput.value.trim();
      if (!code) {
        promoStatusMsg.innerText = 'الرجاء إدخال الكود أولاً!';
        promoStatusMsg.style.color = '#ff5555';
        promoStatusMsg.classList.remove('hidden');
        return;
      }

      try {
        const response = await fetch('/api/promos/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });
        const data = await response.json();

        if (response.ok) {
          promoStatusMsg.innerText = `تم تفعيل الكود بنجاح! خصم بقيمة ${data.percent}%`;
          promoStatusMsg.style.color = '#10b981';
          promoStatusMsg.classList.remove('hidden');
          activeAppliedPromoCode = data.code;
          
          if (currentUser) {
            currentUser.discountPercent = data.percent;
            currentUser.specialOffer = `خصم ${data.percent}% باستخدام كود ${data.code}`;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            loadPortalData();
          }
        } else {
          promoStatusMsg.innerText = data.error || 'كود الخصم غير صحيح!';
          promoStatusMsg.style.color = '#ff5555';
          promoStatusMsg.classList.remove('hidden');
        }
      } catch (err) {
        console.error(err);
        promoStatusMsg.innerText = 'خطأ في الاتصال بالخادم!';
        promoStatusMsg.style.color = '#ff5555';
        promoStatusMsg.classList.remove('hidden');
      }
    });
  }

  // ----------------------------------------------------
  // 8. نظام تقييم مشاريع المعرض والأرشيف
  // ----------------------------------------------------
  let selectedShowcaseRating = 0;
  const showcaseStarBtns = document.querySelectorAll('.showcase-star-btn');
  const btnSubmitShowcaseRating = document.getElementById('btn-submit-showcase-rating');
  const showcaseRatingComment = document.getElementById('showcase-rating-comment');
  const showcaseVisitorName = document.getElementById('showcase-visitor-name');
  const showcaseVisitorEmail = document.getElementById('showcase-visitor-email');
  const showcaseRatingFeedback = document.getElementById('showcase-rating-feedback');

  showcaseStarBtns.forEach(star => {
    star.addEventListener('click', () => {
      selectedShowcaseRating = parseInt(star.getAttribute('data-value'));
      highlightShowcaseStars(selectedShowcaseRating);
    });
    star.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(star.getAttribute('data-value'));
      highlightShowcaseStars(hoverVal);
    });
    star.addEventListener('mouseleave', () => {
      highlightShowcaseStars(selectedShowcaseRating);
    });
  });

  function highlightShowcaseStars(value) {
    showcaseStarBtns.forEach(star => {
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

  if (btnSubmitShowcaseRating) {
    btnSubmitShowcaseRating.addEventListener('click', async () => {
      if (selectedShowcaseRating === 0) {
        alert('من فضلك اختر التقييم بالنجوم أولاً');
        return;
      }
      
      const ratingComment = showcaseRatingComment.value.trim();
      const visitorName = showcaseVisitorName.value.trim() || (currentUser ? currentUser.name : '');
      const visitorEmail = showcaseVisitorEmail.value.trim() || (currentUser ? currentUser.email : '');
      
      try {
        const response = await fetch(`/api/projects/${activeDetailProjectId}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: selectedShowcaseRating,
            ratingComment,
            visitorName,
            visitorEmail
          })
        });
        const data = await response.json();
        
        if (response.ok) {
          showcaseRatingFeedback.innerText = data.message || 'تم تسجيل تقييمك بنجاح! شكرًا لك.';
          showcaseRatingFeedback.classList.remove('hidden');
          
          btnSubmitShowcaseRating.style.display = 'none';
          showcaseRatingComment.disabled = true;
          showcaseVisitorName.disabled = true;
          showcaseVisitorEmail.disabled = true;
          
          loadDynamicStats();
        } else {
          alert(data.error || 'فشل إرسال التقييم');
        }
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

  // ----------------------------------------------------
  // 9. نظام اختيار وتبديل الثيمات المظهرية البسيط (Light/Dark Mode Switcher)
  // ----------------------------------------------------
  const btnToggleDarkMode = document.getElementById('btn-toggle-dark-mode');
  const toggleModeIcon = document.getElementById('toggle-mode-icon');

  function setThemeMode(isLight) {
    const mobileToggleModeIcon = document.getElementById('mobile-toggle-mode-icon');
    if (isLight) {
      document.body.classList.add('light-mode');
      if (toggleModeIcon) {
        toggleModeIcon.className = 'fa-solid fa-sun';
        toggleModeIcon.style.color = '#ffb000';
      }
      if (mobileToggleModeIcon) {
        mobileToggleModeIcon.className = 'fa-solid fa-sun';
        mobileToggleModeIcon.style.color = '#ffb000';
      }
      localStorage.setItem('themeMode', 'light');
    } else {
      document.body.classList.remove('light-mode');
      if (toggleModeIcon) {
        toggleModeIcon.className = 'fa-solid fa-moon';
        toggleModeIcon.style.color = '';
      }
      if (mobileToggleModeIcon) {
        mobileToggleModeIcon.className = 'fa-solid fa-moon';
        mobileToggleModeIcon.style.color = '';
      }
      localStorage.setItem('themeMode', 'dark');
    }
  }

  if (btnToggleDarkMode) {
    btnToggleDarkMode.addEventListener('click', () => {
      const isLight = document.body.classList.contains('light-mode');
      setThemeMode(!isLight);
    });
  }

  const savedThemeMode = localStorage.getItem('themeMode') || 'dark';
  setThemeMode(savedThemeMode === 'light');

  // ----------------------------------------------------
  // 9.5 خلفية النجوم التفاعلية المضيئة (Twinkling Canvas Starfield)
  // ----------------------------------------------------
  const canvas = document.getElementById('starfield-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let stars = [];
    let mouseX = 0;
    let mouseY = 0;
    let mouseActive = false;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    }

    function initStars() {
      stars = [];
      const starsCount = Math.min(Math.round((canvas.width * canvas.height) / 10000), 150);
      for (let i = 0; i < starsCount; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random(),
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleDirection: Math.random() > 0.5 ? 1 : -1,
          depth: Math.random() * 0.4 + 0.1
        });
      }
    }

    function drawStars() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isLight = document.body.classList.contains('light-mode');
      const starColor = isLight ? '15, 23, 42' : '255, 255, 255';
      
      stars.forEach(star => {
        star.alpha += star.twinkleSpeed * star.twinkleDirection;
        if (star.alpha >= 1) {
          star.alpha = 1;
          star.twinkleDirection = -1;
        } else if (star.alpha <= 0.1) {
          star.alpha = 0.1;
          star.twinkleDirection = 1;
        }

        let driftX = 0;
        let driftY = 0;
        if (mouseActive) {
          const centerX = canvas.width / 2;
          const centerY = canvas.height / 2;
          driftX = (mouseX - centerX) * star.depth * 0.1;
          driftY = (mouseY - centerY) * star.depth * 0.1;
        }

        ctx.fillStyle = `rgba(${starColor}, ${star.alpha})`;
        ctx.shadowBlur = isLight ? 0 : star.size * 3;
        ctx.shadowColor = `rgba(0, 240, 255, ${star.alpha * 0.5})`;
        ctx.beginPath();
        ctx.arc(star.x + driftX, star.y + driftY, star.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }

    function animate() {
      drawStars();
      requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      mouseActive = true;
    });
    window.addEventListener('mouseout', () => {
      mouseActive = false;
    });

    resizeCanvas();
    animate();
  }

  // ----------------------------------------------------
  // 10. نظام الإشعارات الصوتية والمرئية بالخلفية
  // ----------------------------------------------------
  function playSciFiChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
      
      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.4);
      
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1568, audioCtx.currentTime + 0.12);
        gain2.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.35);
      }, 80);
    } catch (e) {
      console.warn('Web Audio API not supported or blocked by browser:', e);
    }
  }

  window.showNotificationToast = function(title, message, iconType = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast-card';
    
    let iconClass = 'fa-solid fa-bell';
    if (iconType === 'success') {
      iconClass = 'fa-solid fa-circle-check';
      toast.style.borderLeftColor = '#10b981';
    } else if (iconType === 'warning') {
      iconClass = 'fa-solid fa-triangle-exclamation';
      toast.style.borderLeftColor = '#ffb000';
    } else if (iconType === 'error') {
      iconClass = 'fa-solid fa-circle-xmark';
      toast.style.borderLeftColor = '#ff5555';
    } else if (iconType === 'discount') {
      iconClass = 'fa-solid fa-tag';
      toast.style.borderLeftColor = 'var(--accent-gold)';
    }

    toast.innerHTML = `
      <div class="toast-icon"><i class="${iconClass}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;

    toastContainer.appendChild(toast);
    playSciFiChime();

    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 5000);
  };

  // ----------------------------------------------------
  // 11. نظام الفحص الدوري وتنبيه الطالب بالتغيرات (Polling System)
  // ----------------------------------------------------
  let previousOrdersState = {};

  function startOrderStatePolling() {
    if (!currentUser) return;

    setInterval(async () => {
      try {
        const response = await fetch(`/api/requests?studentId=${currentUser.id}`);
        if (!response.ok) return;
        const requests = await response.json();

        let hasChanges = false;
        requests.forEach(order => {
          const prevStatus = previousOrdersState[order.id];
          
          if (prevStatus && prevStatus !== order.status) {
            hasChanges = true;
            let statusLabel = getStatusLabel(order.status);
            let toastType = 'info';
            if (order.status === 'completed') toastType = 'success';
            if (order.status === 'cancelled') toastType = 'error';

            showNotificationToast(
              'تحديث حالة طلبك 🔔',
              `تم تغيير حالة مشروعك "${order.title}" إلى: <strong>${statusLabel}</strong>`,
              toastType
            );
          }
          previousOrdersState[order.id] = order.status;
        });

        if (hasChanges) {
          fetchStudentRequests();
          updateDashboardStats();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 15000);
  }

  async function initializeOrdersState() {
    if (!currentUser) return;
    try {
      const response = await fetch(`/api/requests?studentId=${currentUser.id}`);
      if (!response.ok) return;
      const requests = await response.json();
      requests.forEach(order => {
        previousOrdersState[order.id] = order.status;
      });
    } catch (err) {
      console.error(err);
    }
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

  // جلب الإعلانات وتفعيل البوب اب
  loadAnnouncements();
});
