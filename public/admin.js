document.addEventListener('DOMContentLoaded', () => {
  // التحقق من صلاحيات الأدمن أولاً
  let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

  // تفعيل التوقيع التلقائي لجميع الطلبات بمعرف الأدمن للتحقق من الصلاحيات بالخادم
  const originalFetch = window.fetch;
  window.fetch = function (url, options = {}) {
    options.headers = options.headers || {};
    if (currentUser && currentUser.id) {
      options.headers['x-user-id'] = currentUser.id;
    }
    return originalFetch(url, options);
  };

  if (!currentUser || currentUser.role !== 'admin') {
    alert('غير مصرح لك بدخول لوحة المطور والمسؤول');
    window.location.href = 'index.html';
    return;
  }

  // عناصر القائمة والتنقل
  const adminLogout = document.getElementById('admin-logout');
  const sidebarItems = document.querySelectorAll('.portal-sidebar .portal-menu-item');
  const panels = document.querySelectorAll('.portal-content .portal-panel');

  // عناصر الإحصائيات العامة
  const statTotalStudents = document.getElementById('stat-total-students');
  const statPendingOrders = document.getElementById('stat-pending-orders');
  const statVerifyPayments = document.getElementById('stat-verify-payments');
  const statCompletedProjects = document.getElementById('stat-completed-projects');
  const adminLatestOrdersTable = document.getElementById('admin-latest-orders-table');

  // عناصر إدارة الطلبات والمشاريع الجارية
  const adminRequestsTableBody = document.getElementById('admin-requests-table-body');
  
  // مودال التسعير والقبول
  const adminPriceModal = document.getElementById('admin-price-modal');
  const adminPriceModalClose = document.getElementById('admin-price-modal-close');
  const priceModalOrderTitle = document.getElementById('price-modal-order-title');
  const priceOrderForm = document.getElementById('price-order-form');
  const orderPriceInput = document.getElementById('order-price-input');
  
  // مودال التسليم والتوصيل
  const adminDeliverModal = document.getElementById('admin-deliver-modal');
  const adminDeliverModalClose = document.getElementById('admin-deliver-modal-close');
  const deliverModalOrderTitle = document.getElementById('deliver-modal-order-title');
  const deliverOrderForm = document.getElementById('deliver-order-form');
  const deliverFileInput = document.getElementById('deliver-file-input');

  // عناصر الأرشيف
  const adminAddProjectForm = document.getElementById('admin-add-project-form');
  const adminArchiveListTable = document.getElementById('admin-archive-list-table');

  // عناصر قاعدة بيانات الطلاب
  const adminStudentsTableBody = document.getElementById('admin-students-table-body');

  let activeOrderId = null;
  let allRequests = [];
  let allStudents = [];
  let allProjects = [];
  let adminCategories = [];

  async function loadCategories() {
    try {
      const response = await fetch('/api/categories');
      adminCategories = await response.json();
      populateNewProjCategorySelect();
    } catch (err) {
      console.error(err);
    }
  }

  function populateNewProjCategorySelect() {
    const select = document.getElementById('new-proj-category');
    const selectEdit = document.getElementById('edit-proj-category');
    
    const fill = (sel) => {
      if (sel) {
        sel.innerHTML = '';
        adminCategories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.innerText = c.label;
          sel.appendChild(opt);
        });
        const optOther = document.createElement('option');
        optOther.value = 'other';
        optOther.innerText = 'تخصص آخر';
        sel.appendChild(optOther);
      }
    };
    
    fill(select);
    fill(selectEdit);
  }

  // ----------------------------------------------------
  // نظام القوائم والتنقل
  // ----------------------------------------------------
  sidebarItems.forEach(item => {
    item.addEventListener('click', (e) => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      e.currentTarget.classList.add('active');

      const targetPanelId = e.currentTarget.getAttribute('data-target');
      panels.forEach(p => p.classList.add('hidden'));
      document.getElementById(targetPanelId).classList.remove('hidden');

      // تحميل البيانات الخاصة باللوحة النشطة
      if (targetPanelId === 'admin-overview-panel') {
        loadOverviewStats();
      } else if (targetPanelId === 'admin-requests-panel') {
        loadRequestsData();
      } else if (targetPanelId === 'admin-archive-panel') {
        loadArchiveData();
      } else if (targetPanelId === 'admin-students-panel') {
        loadStudentsData();
      } else if (targetPanelId === 'admin-categories-panel') {
        loadCategoriesPanel();
      }
    });
  });

  // تسجيل خروج الأدمن
  adminLogout.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
  });

  // ----------------------------------------------------
  // 1. لوحة المراجعة والإحصائيات العامة (Overview)
  // ----------------------------------------------------
  async function loadOverviewStats() {
    try {
      await loadCategories();
      // جلب الطلاب والطلبات والمشاريع
      const resStudents = await fetch('/api/students');
      allStudents = await resStudents.json();

      const resRequests = await fetch('/api/requests');
      allRequests = await resRequests.json();

      const resProjects = await fetch('/api/projects');
      allProjects = await resProjects.json();

      // حساب الإحصائيات
      statTotalStudents.innerText = allStudents.length;
      
      const pendingCount = allRequests.filter(r => r.status === 'pending').length;
      statPendingOrders.innerText = pendingCount;

      const verifyCount = allRequests.filter(r => r.status === 'ready_payment_verify').length;
      statVerifyPayments.innerText = verifyCount;

      const completedCount = allRequests.filter(r => r.status === 'completed').length;
      statCompletedProjects.innerText = completedCount;

      // ملء جدول أحدث الطلبات
      adminLatestOrdersTable.innerHTML = '';
      const latestOrders = allRequests.slice(-5).reverse(); // آخر 5 طلبات

      if (latestOrders.length === 0) {
        adminLatestOrdersTable.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">لا توجد طلبات مستلمة حالياً.</td></tr>`;
        return;
      }

      latestOrders.forEach(o => {
        const tr = document.createElement('tr');
        const formattedDate = new Date(o.deadline).toLocaleDateString('ar-EG');
        tr.innerHTML = `
          <td><strong>${o.studentName}</strong></td>
          <td>${o.title}</td>
          <td>${formattedDate}</td>
          <td><span class="badge ${getBadgeClass(o.status)}">${getStatusLabel(o.status)}</span></td>
        `;
        adminLatestOrdersTable.appendChild(tr);
      });

    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }

  // ----------------------------------------------------
  // 2. إدارة طلبات الطلاب وتحديث الحالات (Requests panel)
  // ----------------------------------------------------
  async function loadRequestsData() {
    try {
      const res = await fetch('/api/requests');
      allRequests = await res.json();
      filterAdminRequests();
    } catch (err) {
      console.error(err);
    }
  }

  function filterAdminRequests() {
    const filterTabsContainer = document.getElementById('admin-requests-filters');
    if (!filterTabsContainer) {
      renderRequestsTable(allRequests);
      return;
    }
    const activeTab = filterTabsContainer.querySelector('.filter-tab.active');
    const status = activeTab ? activeTab.getAttribute('data-status') : 'all';

    let filtered = allRequests;
    if (status !== 'all') {
      filtered = allRequests.filter(r => r.status === status);
    }
    renderRequestsTable(filtered);
  }

  // ربط مستمعات تصفية طلبات الأدمن
  setTimeout(() => {
    const filterTabsContainer = document.getElementById('admin-requests-filters');
    if (filterTabsContainer) {
      const tabs = filterTabsContainer.querySelectorAll('.filter-tab');
      tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
          tabs.forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          filterAdminRequests();
        });
      });
    }
  }, 100);

  function renderRequestsTable(requests) {
    adminRequestsTableBody.innerHTML = '';
    if (requests.length === 0) {
      adminRequestsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">لا توجد طلبات مسجلة للطلاب حالياً.</td></tr>`;
      return;
    }

    requests.slice().reverse().forEach(r => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(r.deadline).toLocaleDateString('ar-EG');
      const priceText = r.price > 0 ? `${r.price} EGP` : 'يحدد لاحقاً';
      
      // توليد زر الإجراء بناءً على الحالة الحالية للطلب
      let actionButtons = '';
      if (r.status === 'pending') {
        actionButtons = `<button class="btn btn-primary btn-xs btn-admin-price" data-id="${r.id}">تسعير وقبول</button>`;
      } else if (r.status === 'accepted') {
        actionButtons = `<button class="btn btn-outline btn-xs btn-admin-progress" data-id="${r.id}">بدء العمل الجاري</button>`;
      } else if (r.status === 'in_progress') {
        actionButtons = `<button class="btn btn-secondary btn-xs btn-admin-ready-pay" data-id="${r.id}">تجهيز للدفع</button>`;
      } else if (r.status === 'ready_payment') {
        actionButtons = `<span style="font-size: 0.8rem; color: var(--text-muted);">في انتظار تحويل الطالب</span>`;
      } else if (r.status === 'ready_payment_verify') {
        actionButtons = `
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-primary btn-xs btn-admin-confirm-pay" data-id="${r.id}">تأكيد الدفع</button>
            <button class="btn btn-outline btn-xs btn-view-tx" data-tx="${r.transactionId}" data-method="${r.paymentMethod}">عرض رقم التحويل</button>
          </div>
        `;
      } else if (r.status === 'paid') {
        actionButtons = `<button class="btn btn-secondary btn-xs btn-admin-deliver" data-id="${r.id}">رفع وتسليم الكود</button>`;
      } else if (r.status === 'completed') {
        actionButtons = `<a href="${r.deliveryFile}" class="btn btn-outline btn-xs" download><i class="fa-solid fa-download"></i> ملف التسليم</a>`;
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700;">${r.studentName}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${r.college}</div>
        </td>
        <td>
          <div>${r.title}</div>
          ${r.attachmentFile ? `<a href="${r.attachmentFile}" download style="font-size:0.75rem; color:var(--primary-cyan); text-decoration:none;"><i class="fa-solid fa-paperclip"></i> تحميل ملف الطالب</a>` : ''}
        </td>
        <td>${formattedDate}</td>
        <td style="font-family: 'Orbitron', sans-serif;">${priceText}</td>
        <td>
          <span class="badge ${getBadgeClass(r.status)}">${getStatusLabel(r.status)}</span>
          ${r.status === 'completed' && r.rating ? `
            <div style="color: var(--accent-gold); font-size: 0.8rem; margin-top: 0.3rem;" title="${r.ratingComment || 'بدون تعليق'}">
              <i class="fa-solid fa-star"></i> ${r.rating}/5
              ${r.ratingComment ? `<div style="font-size: 0.65rem; color: var(--text-muted); max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.ratingComment}</div>` : ''}
            </div>
          ` : ''}
        </td>
        <td>${actionButtons}</td>
      `;
      adminRequestsTableBody.appendChild(tr);
    });

    // ربط الأحداث بالأزرار
    document.querySelectorAll('.btn-admin-price').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openPriceModal(id);
      });
    });

    document.querySelectorAll('.btn-admin-progress').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        updateOrderStatus(id, 'in_progress');
      });
    });

    document.querySelectorAll('.btn-admin-ready-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        updateOrderStatus(id, 'ready_payment');
      });
    });

    document.querySelectorAll('.btn-admin-confirm-pay').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('هل أنت متأكد من استلام الحساب والتحويل المالي لهذا الطلب؟')) {
          await confirmOrderPayment(id);
        }
      });
    });

    document.querySelectorAll('.btn-view-tx').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tx = e.currentTarget.getAttribute('data-tx');
        const method = e.currentTarget.getAttribute('data-method');
        alert(`طريقة الدفع: ${method}\nرقم العملية المرفق: ${tx}`);
      });
    });

    document.querySelectorAll('.btn-admin-deliver').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openDeliverModal(id);
      });
    });
  }

  // تحديث حالة الطلب
  async function updateOrderStatus(id, status, price = undefined) {
    try {
      const response = await fetch(`/api/requests/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, price })
      });
      if (response.ok) {
        loadRequestsData();
      } else {
        alert('فشل تحديث حالة الطلب');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // تأكيد الدفع
  async function confirmOrderPayment(id) {
    try {
      const response = await fetch(`/api/requests/${id}/confirm-payment`, {
        method: 'PUT'
      });
      if (response.ok) {
        alert('تم تأكيد الدفع بنجاح! يمكن الآن الانتقال لتسليم الملفات.');
        loadRequestsData();
      } else {
        alert('فشل تأكيد الدفع');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // فتح وإغلاق مودال التسعير
  function openPriceModal(id) {
    activeOrderId = id;
    const order = allRequests.find(r => r.id === id);
    if (!order) return;

    priceModalOrderTitle.innerText = order.title;
    orderPriceInput.value = '';
    adminPriceModal.classList.add('active');
  }

  adminPriceModalClose.addEventListener('click', () => adminPriceModal.classList.remove('active'));
  priceOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = orderPriceInput.value;
    await updateOrderStatus(activeOrderId, 'accepted', price);
    adminPriceModal.classList.remove('active');
  });

  // متغيرات تبديل تابات التسليم للأدمن
  let activeDeliverType = 'file';
  const deliverTabFile = document.getElementById('deliver-tab-file');
  const deliverTabLink = document.getElementById('deliver-tab-link');
  const deliverFileGroup = document.getElementById('deliver-file-group');
  const deliverLinkGroup = document.getElementById('deliver-link-group');
  const deliverLinkInput = document.getElementById('deliver-link-input');

  if (deliverTabFile && deliverTabLink) {
    deliverTabFile.addEventListener('click', () => {
      activeDeliverType = 'file';
      deliverTabFile.classList.add('active');
      deliverTabLink.classList.remove('active');
      deliverFileGroup.classList.remove('hidden');
      deliverLinkGroup.classList.add('hidden');
    });

    deliverTabLink.addEventListener('click', () => {
      activeDeliverType = 'link';
      deliverTabLink.classList.add('active');
      deliverTabFile.classList.remove('active');
      deliverLinkGroup.classList.remove('hidden');
      deliverFileGroup.classList.add('hidden');
    });
  }

  // فتح وإغلاق مودال التسليم
  function openDeliverModal(id) {
    activeOrderId = id;
    const order = allRequests.find(r => r.id === id);
    if (!order) return;

    deliverModalOrderTitle.innerText = order.title;
    deliverFileInput.value = '';
    if (deliverLinkInput) deliverLinkInput.value = '';
    
    // إعادة تعيين للتبويب الافتراضي (الملف)
    if (deliverTabFile) deliverTabFile.click();
    
    adminDeliverModal.classList.add('active');
  }

  adminDeliverModalClose.addEventListener('click', () => adminDeliverModal.classList.remove('active'));
  deliverOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData();

    if (activeDeliverType === 'file') {
      if (deliverFileInput.files.length === 0) {
        alert('من فضلك اختر ملف التسليم');
        return;
      }
      formData.append('delivery', deliverFileInput.files[0]);
    } else {
      const linkVal = deliverLinkInput.value.trim();
      if (!linkVal) {
        alert('من فضلك أدخل رابط التسليم');
        return;
      }
      formData.append('deliveryLink', linkVal);
    }

    try {
      const response = await fetch(`/api/requests/${activeOrderId}/deliver`, {
        method: 'PUT',
        body: formData
      });

      if (response.ok) {
        alert('تم تسليم المشروع وإرسال ملفات/رابط التسليم إلى بوابة الطالب بنجاح!');
        adminDeliverModal.classList.remove('active');
        loadRequestsData();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'فشل عملية الرفع والملفات الموصولة');
      }
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // ----------------------------------------------------
  // 3. إدارة الأرشيف العام للمشاريع المعروضة للطلاب
  // ----------------------------------------------------
  async function loadArchiveData() {
    try {
      await loadCategories();
      const res = await fetch('/api/projects');
      allProjects = await res.json();
      renderArchiveTable(allProjects);
    } catch (err) {
      console.error(err);
    }
  }

  function renderArchiveTable(projects) {
    adminArchiveListTable.innerHTML = '';
    if (projects.length === 0) {
      adminArchiveListTable.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">لا توجد مشاريع مرفوعة بالأرشيف العام بعد.</td></tr>`;
      return;
    }

    projects.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700;">${p.title}</td>
        <td><span class="badge badge-accepted">${getCategoryLabel(p.category)}</span></td>
        <td>${p.college}</td>
        <td>
          <div class="project-tags">
            ${p.techUsed.split(',').map(t => `<span class="tag">${t.trim()}</span>`).join('')}
          </div>
        </td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn btn-outline btn-xs btn-admin-edit-project" data-id="${p.id}" style="color: var(--primary-cyan); border-color: rgba(0, 240, 255, 0.2);">
              <i class="fa-solid fa-pen-to-square"></i> تعديل
            </button>
            <button class="btn btn-outline btn-xs btn-admin-delete-project" data-id="${p.id}" style="color: var(--secondary-magenta); border-color: rgba(255, 0, 127, 0.2);">
              <i class="fa-solid fa-trash"></i> حذف
            </button>
          </div>
        </td>
      `;
      adminArchiveListTable.appendChild(tr);
    });

    // ربط مستمعات الحذف
    document.querySelectorAll('.btn-admin-delete-project').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع نهائياً من أرشيف المعرض العام؟')) {
          await deleteArchiveProject(id);
        }
      });
    });

    // ربط مستمعات التعديل
    document.querySelectorAll('.btn-admin-edit-project').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openEditProjectModal(id);
      });
    });
  }

  async function deleteArchiveProject(id) {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('تم حذف المشروع بنجاح من الأرشيف.');
        loadArchiveData();
      } else {
        alert('فشل عملية الحذف.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // تعديل بيانات مشروع في الأرشيف
  let activeEditProjectId = null;
  const adminEditProjectModal = document.getElementById('admin-edit-project-modal');
  const adminEditProjectModalClose = document.getElementById('admin-edit-project-modal-close');
  const adminEditProjectForm = document.getElementById('admin-edit-project-form');

  function openEditProjectModal(id) {
    activeEditProjectId = id;
    const project = allProjects.find(p => p.id === id);
    if (!project) return;

    document.getElementById('edit-proj-title').value = project.title;
    document.getElementById('edit-proj-category').value = project.category;
    document.getElementById('edit-proj-college').value = project.college;
    document.getElementById('edit-proj-desc').value = project.description;
    document.getElementById('edit-proj-tech').value = project.techUsed;
    document.getElementById('edit-proj-image').value = '';
    document.getElementById('edit-proj-file').value = '';

    adminEditProjectModal.classList.add('active');
  }

  if (adminEditProjectModalClose) {
    adminEditProjectModalClose.addEventListener('click', () => {
      adminEditProjectModal.classList.remove('active');
    });
  }

  if (adminEditProjectForm) {
    adminEditProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('edit-proj-title').value;
      const category = document.getElementById('edit-proj-category').value;
      const college = document.getElementById('edit-proj-college').value;
      const description = document.getElementById('edit-proj-desc').value;
      const techUsed = document.getElementById('edit-proj-tech').value;
      const imageInput = document.getElementById('edit-proj-image');
      const fileInput = document.getElementById('edit-proj-file');

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('college', college);
      formData.append('description', description);
      formData.append('techUsed', techUsed);

      if (imageInput && imageInput.files.length > 0) {
        formData.append('projectImage', imageInput.files[0]);
      }
      if (fileInput && fileInput.files.length > 0) {
        formData.append('projectFile', fileInput.files[0]);
      }

      try {
        const response = await fetch(`/api/projects/${activeEditProjectId}`, {
          method: 'PUT',
          body: formData
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'حدث خطأ أثناء تعديل المشروع');
          return;
        }

        alert('تم تعديل بيانات المشروع وحفظ التحديثات بنجاح!');
        adminEditProjectModal.classList.remove('active');
        loadArchiveData();
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

  // إضافة مشروع جديد للأرشيف
  adminAddProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('new-proj-title').value;
    const category = document.getElementById('new-proj-category').value;
    const college = document.getElementById('new-proj-college').value;
    const description = document.getElementById('new-proj-desc').value;
    const techUsed = document.getElementById('new-proj-tech').value;
    const imageInput = document.getElementById('new-proj-image');
    const fileInput = document.getElementById('new-proj-file');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('college', college);
    formData.append('description', description);
    formData.append('techUsed', techUsed);

    if (imageInput && imageInput.files.length > 0) {
      formData.append('projectImage', imageInput.files[0]);
    }
    if (fileInput && fileInput.files.length > 0) {
      formData.append('projectFile', fileInput.files[0]);
    }

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'حدث خطأ أثناء إضافة المشروع');
        return;
      }

      alert('تم رفع وإضافة المشروع الجديد للأرشيف العام بنجاح!');
      adminAddProjectForm.reset();
      loadArchiveData();
    } catch (err) {
      console.error(err);
      alert('خطأ في الاتصال بالخادم');
    }
  });

  // ----------------------------------------------------
  // 4. إدارة قاعدة بيانات الطلاب (Students database)
  // ----------------------------------------------------
  async function loadStudentsData() {
    try {
      const res = await fetch('/api/students');
      allStudents = await res.json();
      renderStudentsTable(allStudents);
    } catch (err) {
      console.error(err);
    }
  }

  function renderStudentsTable(students) {
    adminStudentsTableBody.innerHTML = '';
    if (students.length === 0) {
      adminStudentsTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">لا يوجد طلاب مسجلين بالمنصة حالياً.</td></tr>`;
      return;
    }

    students.forEach(s => {
      const tr = document.createElement('tr');
      
      const discountLabel = s.discountPercent > 0 ? `<span style="color: #ff5555; font-weight:700; background: rgba(255, 85, 85, 0.1); border: 1px solid rgba(255, 85, 85, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.8rem;">%${s.discountPercent} خصم</span>` : '<span style="color: var(--text-muted); font-size: 0.85rem;">لا يوجد خصم</span>';
      const offerLabel = s.specialOffer ? `<div style="font-size:0.75rem; color: var(--accent-gold); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 0.2rem;" title="${s.specialOffer}"><i class="fa-solid fa-gift"></i> ${s.specialOffer}</div>` : '';

      tr.innerHTML = `
        <td style="font-weight: 700;">${s.name}</td>
        <td style="font-family: 'Orbitron', sans-serif;">${s.email}</td>
        <td style="font-family: 'Orbitron', sans-serif; direction: ltr; text-align: right;">${s.phone}</td>
        <td>${s.university} - ${s.major}</td>
        <td>
          <div style="display: flex; flex-direction: column;">
            ${discountLabel}
            ${offerLabel}
          </div>
        </td>
        <td style="font-family: 'Orbitron', sans-serif; text-align: center; font-weight:700;">${s.ordersCount}</td>
        <td style="font-family: 'Orbitron', sans-serif; color: var(--primary-cyan); font-weight: 700;">${s.totalSpent} EGP</td>
        <td style="text-align: center; vertical-align: middle;">
          <button class="btn btn-outline btn-xs btn-admin-student-privileges" data-id="${s.id}" style="color: var(--accent-gold); border-color: rgba(255, 215, 0, 0.25); display: inline-flex; justify-content: center; align-items: center; gap: 0.3rem;">
            <i class="fa-solid fa-gift"></i> الامتيازات
          </button>
        </td>
      `;
      adminStudentsTableBody.appendChild(tr);
    });

    // ربط مستمعات تعديل الامتيازات
    document.querySelectorAll('.btn-admin-student-privileges').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openStudentPrivilegesModal(id);
      });
    });
  }

  // إدارة امتيازات وخصومات الطلاب
  let activeStudentIdPrivilege = null;
  const adminStudentPrivilegesModal = document.getElementById('admin-student-privileges-modal');
  const adminStudentPrivilegesModalClose = document.getElementById('admin-student-privileges-modal-close');
  const studentPrivilegesForm = document.getElementById('student-privileges-form');
  const privilegesModalStudentName = document.getElementById('privileges-modal-student-name');
  const studentDiscountInput = document.getElementById('student-discount-input');
  const studentOfferInput = document.getElementById('student-offer-input');

  function openStudentPrivilegesModal(studentId) {
    activeStudentIdPrivilege = studentId;
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    privilegesModalStudentName.innerText = `امتيازات الطالب: ${student.name}`;
    studentDiscountInput.value = student.discountPercent || 0;
    studentOfferInput.value = student.specialOffer || '';

    adminStudentPrivilegesModal.classList.add('active');
  }

  if (adminStudentPrivilegesModalClose) {
    adminStudentPrivilegesModalClose.addEventListener('click', () => {
      adminStudentPrivilegesModal.classList.remove('active');
    });
  }

  if (studentPrivilegesForm) {
    studentPrivilegesForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const discountPercent = Number(studentDiscountInput.value) || 0;
      const specialOffer = studentOfferInput.value.trim();

      try {
        const response = await fetch(`/api/students/${activeStudentIdPrivilege}/privileges`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ discountPercent, specialOffer })
        });
        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'حدث خطأ أثناء تعديل الامتيازات');
          return;
        }

        alert('تم تعديل وحفظ امتيازات الطالب بنجاح! ستظهر له في حسابه فوراً.');
        adminStudentPrivilegesModal.classList.remove('active');
        loadStudentsData(); // إعادة تحميل الجدول
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

  // ----------------------------------------------------
  // دوال وتنسيقات مساعدة
  // ----------------------------------------------------
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

  function getCategoryLabel(cat) {
    if (cat === 'all') return 'الكل';
    const found = adminCategories.find(c => c.id === cat);
    return found ? found.label : (cat === 'other' ? 'تخصص آخر' : cat);
  }

  // ----------------------------------------------------
  // 5. إدارة الأقسام والتصنيفات (Categories Panel)
  // ----------------------------------------------------
  const adminAddCategoryForm = document.getElementById('admin-add-category-form');
  const adminCategoriesListTable = document.getElementById('admin-categories-list-table');

  async function loadCategoriesPanel() {
    await loadCategories();
    renderCategoriesTable();
  }

  function renderCategoriesTable() {
    adminCategoriesListTable.innerHTML = '';
    if (adminCategories.length === 0) {
      adminCategoriesListTable.innerHTML = `<tr><td colspan="2" style="text-align: center; color: var(--text-secondary); padding: 1.5rem;">لا توجد أقسام مسجلة بالمنصة بعد.</td></tr>`;
      return;
    }

    adminCategories.forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:700;">${c.label}</td>
        <td style="text-align: left;">
          <button class="btn btn-outline btn-xs btn-admin-delete-category" data-id="${c.id}" style="color: var(--secondary-magenta); border-color: rgba(255, 0, 127, 0.2);">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </td>
      `;
      adminCategoriesListTable.appendChild(tr);
    });

    // ربط أزرار حذف الأقسام
    document.querySelectorAll('.btn-admin-delete-category').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('هل أنت متأكد من حذف هذا القسم؟ (ملاحظة: هذا لن يحذف المشاريع المرتبطة به ولكنها قد تظهر بقسم "تخصص آخر")')) {
          await deleteCategory(id);
        }
      });
    });
  }

  async function deleteCategory(id) {
    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('تم حذف القسم بنجاح.');
        await loadCategoriesPanel();
      } else {
        alert('فشل عملية الحذف.');
      }
    } catch (err) {
      console.error(err);
    }
  }

  // إضافة قسم جديد
  if (adminAddCategoryForm) {
    adminAddCategoryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = document.getElementById('new-cat-label').value;

      try {
        const response = await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label })
        });
        const data = await response.json();

        if (response.ok) {
          alert('تم إضافة القسم الجديد بنجاح!');
          document.getElementById('new-cat-label').value = '';
          await loadCategoriesPanel();
        } else {
          alert(data.error || 'حدث خطأ أثناء إضافة القسم');
        }
      } catch (err) {
        console.error(err);
        alert('خطأ في الاتصال بالخادم');
      }
    });
  }

  // تشغيل الإحصائيات لأول مرة عند تحميل الملف
  loadOverviewStats();
});
