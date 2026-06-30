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
  const priceModalDetailsBox = document.getElementById('price-modal-details-box');
  
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
  const adminStudentsCardsContainer = document.getElementById('admin-students-cards-container');

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
      } else if (targetPanelId === 'admin-announcements-panel') {
        fetchAnnouncements();
      } else if (targetPanelId === 'admin-project-ratings-panel') {
        fetchProjectRatings();
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

      // رسم وتحديث المخططات البيانية
      renderDashboardCharts(allRequests);

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
      const formattedDate = new Date(r.deadline).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
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
          <div style="display: flex; gap: 0.4rem; flex-direction: column;">
            <button class="btn btn-primary btn-xs btn-admin-confirm-pay" data-id="${r.id}" style="width: 100%;">تأكيد الدفع ✅</button>
            ${r.paymentReceipt ? `<a href="${r.paymentReceipt}" target="_blank" class="btn btn-outline btn-xs" style="width: 100%; color: var(--accent-gold); border-color: rgba(212,175,55,0.3); text-align:center;"><i class="fa-solid fa-image"></i> عرض إثبات الدفع 📸</a>` : ''}
            <button class="btn btn-outline btn-xs btn-view-tx" data-tx="${r.transactionId || 'غير متوفر'}" data-method="${r.paymentMethod || 'غير محدد'}" style="width: 100%;">تفاصيل المعاملة</button>
          </div>
        `;
      } else if (r.status === 'paid') {
        actionButtons = `<button class="btn btn-secondary btn-xs btn-admin-deliver" data-id="${r.id}">رفع وتسليم الكود</button>`;
      } else if (r.status === 'completed') {
        actionButtons = `<a href="${r.deliveryFile}" class="btn btn-outline btn-xs" download><i class="fa-solid fa-download"></i> ملف التسليم</a>`;
      } else if (r.status === 'cancelled') {
        actionButtons = `<span style="font-size: 0.75rem; color: #ff5555; font-weight: 700;">تم إلغاء الطلب</span>`;
      }

      // إضافة زر إلغاء الطلب للأدمن لكل الحالات عدا مكتمل وملغي
      if (r.status !== 'completed' && r.status !== 'cancelled') {
        actionButtons += `
          <button class="btn btn-outline btn-xs btn-admin-cancel" data-id="${r.id}" style="color:#ff5555; border-color:rgba(255,85,85,0.25); margin-top:0.4rem; display:block; width:100%; text-align:center;" title="إلغاء الطلب">إلغاء 🚫</button>
        `;
      }

      // إنشاء رابط واتساب ذكي للتواصل
      let waLink = '';
      if (r.studentPhone) {
        let cleanPhone = r.studentPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '2' + cleanPhone;
        }
        const text = encodeURIComponent(`مرحباً يا ${r.studentName}، أنا مطور منصة AH CLUB بخصوص طلبك لـ "${r.title}"...`);
        waLink = `https://wa.me/${cleanPhone}?text=${text}`;
      }

      tr.innerHTML = `
        <td>
          <div style="font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
            ${r.studentName}
            ${waLink ? `
              <a href="${waLink}" target="_blank" style="color: #25d366; font-size: 0.9rem;" title="تواصل واتساب مع الطالب">
                <i class="fa-brands fa-whatsapp"></i>
              </a>
            ` : ''}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${r.college || 'غير محدد'} | ${r.university || 'غير محدد'}</div>
        </td>
        <td>
          <div style="font-weight: 700;">${r.title}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.2rem; line-height: 1.4;">
            <span>صيغة التسليم: <strong>${r.deliveryFormat === 'word' ? 'Word' : r.deliveryFormat === 'ppt' ? 'PowerPoint (' + r.slideCount + ' شريحة)' : 'Poster'}</strong></span> | 
            <span>حجم الفريق: <strong>${r.teamSize} طلاب</strong></span><br>
            <span>الداتا: <strong>${r.hasData ? 'من الطالب (حلال ✅)' : 'من المطور (+75 EGP)'}</strong></span> | 
            <span>الحاسبة التقديرية: <strong>${r.estimatedPrice || 0} EGP</strong></span>
          </div>
          ${r.attachmentFile ? `<a href="${r.attachmentFile}" download style="font-size:0.75rem; color:var(--primary-cyan); text-decoration:none; margin-top: 0.3rem; display: inline-block;"><i class="fa-solid fa-paperclip"></i> تحميل ملف المادة العلمية للطالب</a>` : ''}
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
        window.showNotificationToast('تفاصيل الدفع ورقم التحويل', `طريقة الدفع: ${method} | رقم العملية المرفق: ${tx}`, 'info');
      });
    });

    document.querySelectorAll('.btn-admin-deliver').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openDeliverModal(id);
      });
    });

    document.querySelectorAll('.btn-admin-cancel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openCancelModal(id);
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
        window.showNotificationToast('فشل العملية', 'فشل تحديث حالة الطلب.', 'error');
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
        window.showNotificationToast('تم تأكيد الدفع', 'تم تأكيد الدفع بنجاح! يمكن الآن الانتقال لتسليم الملفات.', 'success');
        loadRequestsData();
      } else {
        window.showNotificationToast('فشل تأكيد الدفع', 'حدث خطأ أثناء محاولة تأكيد الدفع.', 'error');
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

    if (priceModalDetailsBox) {
      // إنشاء رابط واتساب ذكي للتواصل
      let waLink = '';
      if (order.studentPhone) {
        let cleanPhone = order.studentPhone.replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
          cleanPhone = '2' + cleanPhone;
        }
        const text = encodeURIComponent(`مرحباً يا ${order.studentName}، أنا مطور منصة AH CLUB بخصوص طلبك لـ "${order.title}"...`);
        waLink = `https://wa.me/${cleanPhone}?text=${text}`;
      }

      priceModalDetailsBox.innerHTML = `
        <div style="margin-bottom: 0.8rem; display: flex; justify-content: space-between; align-items: center;">
          <span>الطالب: <strong>${order.studentName}</strong></span>
          ${waLink ? `
            <a href="${waLink}" target="_blank" class="btn btn-secondary btn-xs" style="background:#25d366; border-color:#25d366; color:#fff; font-family:'Cairo'; display:inline-flex; align-items:center; gap:0.3rem;">
              واتساب الطالب <i class="fa-brands fa-whatsapp"></i>
            </a>
          ` : ''}
        </div>
        <div style="margin-bottom: 0.4rem;">الكلية والجامعة: <strong>${order.college || 'غير محدد'} | ${order.university || 'غير محدد'}</strong></div>
        <div style="margin-bottom: 0.4rem;">صيغة التسليم: <strong>${order.deliveryFormat === 'word' ? 'Word' : order.deliveryFormat === 'ppt' ? 'PowerPoint (' + order.slideCount + ' شريحة)' : 'Poster'}</strong></div>
        <div style="margin-bottom: 0.4rem;">حجم الفريق: <strong>${order.teamSize} طلاب</strong></div>
        <div style="margin-bottom: 0.4rem;">حالة الداتا: <strong>${order.hasData ? 'من الطالب (أوفر ومطابق شرعياً ✅)' : 'من المطور (+75 EGP)'}</strong></div>
        <div style="margin-bottom: 0.4rem; color: var(--primary-cyan);">التسعير المقدر بالحاسبة: <strong>${order.estimatedPrice || 0} EGP</strong></div>
        <div style="margin-bottom: 0.6rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.6rem;">
          <div style="font-weight:700; margin-bottom:0.2rem;">الوصف والمتطلبات:</div>
          <div style="background:rgba(0,0,0,0.2); border-radius:6px; padding:0.6rem; max-height:100px; overflow-y:auto; color:var(--text-secondary); white-space:pre-wrap;">${order.description}</div>
        </div>
        ${order.attachmentFile ? `
          <a href="${order.attachmentFile}" download class="btn btn-outline btn-xs" style="width:100%; text-align:center; display:block;">
            <i class="fa-solid fa-download"></i> تحميل ملف المادة العلمية للطالب
          </a>
        ` : '<div style="color:var(--text-muted); font-size:0.8rem;">(لم يتم رفع ملف مادة علمية من الطالب)</div>'}
      `;
    }

    adminPriceModal.classList.add('active');
  }

  adminPriceModalClose.addEventListener('click', () => adminPriceModal.classList.remove('active'));
  priceOrderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const price = orderPriceInput.value;
    await updateOrderStatus(activeOrderId, 'accepted', price);
    adminPriceModal.classList.remove('active');
  });

  // فتح وإغلاق مودال إلغاء الطلب بالسبب
  const adminCancelModal = document.getElementById('admin-cancel-modal');
  const adminCancelModalClose = document.getElementById('admin-cancel-modal-close');
  const cancelModalOrderTitle = document.getElementById('cancel-modal-order-title');
  const cancelOrderForm = document.getElementById('cancel-order-form');
  const orderCancelReasonInput = document.getElementById('order-cancel-reason-input');

  function openCancelModal(id) {
    activeOrderId = id;
    const order = allRequests.find(r => r.id === id);
    if (!order) return;

    if (cancelModalOrderTitle) cancelModalOrderTitle.innerText = order.title;
    if (orderCancelReasonInput) orderCancelReasonInput.value = '';
    if (adminCancelModal) adminCancelModal.classList.add('active');
  }

  if (adminCancelModalClose) {
    adminCancelModalClose.addEventListener('click', () => {
      if (adminCancelModal) adminCancelModal.classList.remove('active');
    });
  }

  if (cancelOrderForm) {
    cancelOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const reason = orderCancelReasonInput.value.trim();
      if (!reason) return;

      try {
        const response = await fetch(`/api/requests/${activeOrderId}/cancel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason })
        });

        if (response.ok) {
          window.showNotificationToast('تم إلغاء الطلب', 'تم إلغاء الطلب بنجاح وإرسال السبب للطالب!', 'success');
          if (adminCancelModal) adminCancelModal.classList.remove('active');
          loadRequestsData();
        } else {
          const errData = await response.json();
          window.showNotificationToast('فشل الإلغاء', errData.error || 'فشل إلغاء الطلب.', 'error');
        }
      } catch (err) {
        console.error(err);
        window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
      }
    });
  }

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
        window.showNotificationToast('تنبيه', 'من فضلك اختر ملف التسليم أولاً.', 'warning');
        return;
      }
      formData.append('delivery', deliverFileInput.files[0]);
    } else {
      const linkVal = deliverLinkInput.value.trim();
      if (!linkVal) {
        window.showNotificationToast('تنبيه', 'من فضلك أدخل رابط التسليم أولاً.', 'warning');
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
        window.showNotificationToast('تم التسليم بنجاح', 'تم تسليم المشروع وإرسال ملفات/رابط التسليم إلى بوابة الطالب بنجاح!', 'success');
        adminDeliverModal.classList.remove('active');
        loadRequestsData();
      } else {
        const errorData = await response.json();
        window.showNotificationToast('فشل التسليم', errorData.error || 'فشل عملية الرفع والملفات الموصولة.', 'error');
      }
    } catch (err) {
      console.error(err);
      window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
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
        window.showNotificationToast('تم الحذف بنجاح', 'تم حذف المشروع بنجاح من الأرشيف.', 'success');
        loadArchiveData();
      } else {
        window.showNotificationToast('فشل الحذف', 'فشل عملية الحذف من الأرشيف.', 'error');
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
    document.getElementById('edit-proj-link').value = (project.link && project.link.startsWith('http')) ? project.link : '';
    document.getElementById('edit-proj-image').value = '';
    document.getElementById('edit-proj-file').value = '';

    adminEditProjectModal.classList.add('active');
  }

  if (adminEditProjectModalClose) {
    adminEditProjectModalClose.addEventListener('click', () => {
      adminEditProjectModal.classList.remove('active');
    });
  }

  function addWatermarkToImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          // رسم الصورة الأصلية
          ctx.drawImage(img, 0, 0);
          
          ctx.save();
          
          // تحديد حجم الخط بناء على أبعاد الصورة
          const fontSize = Math.max(Math.round(img.width / 15), 18);
          ctx.font = `bold ${fontSize}px 'Orbitron', 'Cairo', sans-serif`;
          
          // تنسيق الخط واللون والشفافية للعلامة المائية
          ctx.fillStyle = 'rgba(0, 240, 255, 0.15)'; // Cyan شفاف
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.1)'; // Magenta شفاف
          ctx.lineWidth = Math.max(Math.round(fontSize / 30), 1);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // تدوير العلامة المائية
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(-25 * Math.PI / 180);
          
          // رسم النص الرئيسي في المركز
          const text = 'AH CLUB';
          ctx.fillText(text, 0, 0);
          ctx.strokeText(text, 0, 0);
          
          // تكرار العلامة المائية بشكل شبكي خفيف لتصعيب السرقة
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; // أبيض خفيف جداً
          const stepX = img.width / 3.5;
          const stepY = img.height / 3.5;
          for (let x = -img.width; x < img.width; x += stepX) {
            for (let y = -img.height; y < img.height; y += stepY) {
              if (Math.abs(x) < 50 && Math.abs(y) < 50) continue; // تم رسم المركز بالفعل
              ctx.fillText('AH CLUB', x, y);
            }
          }
          
          ctx.restore();
          
          // استخراج الصورة بصيغة JPEG ذات جودة مناسبة وحجم ملف مضغوط
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadFileWithProgress(url, method, formData, progressContainer, progressBar, progressPercent, submitBtn, originalBtnHtml, successCallback, errorCallback) {
    const xhr = new XMLHttpRequest();

    if (progressContainer) {
      progressContainer.classList.remove('hidden');
      if (progressBar) progressBar.style.width = '0%';
      if (progressPercent) progressPercent.innerText = '0%';
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'جاري الرفع... <i class="fa-solid fa-spinner fa-spin"></i>';
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (progressPercent) progressPercent.innerText = pct + '%';
        if (submitBtn) {
          submitBtn.innerHTML = `جاري الرفع ${pct}%... <i class="fa-solid fa-spinner fa-spin"></i>`;
        }
      }
    });

    xhr.addEventListener('load', () => {
      if (progressContainer) progressContainer.classList.add('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }

      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch (jsonErr) {
        if (xhr.status === 413) {
          data = { error: 'الملف كبير جداً! الحد الأقصى لحجم الطلب على Vercel هو 4.5 ميجابايت.' };
        } else {
          data = { error: 'حدث خطأ في استجابة السيرفر، يرجى التحقق من حجم الملفات' };
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        successCallback(data);
      } else {
        errorCallback(data.error || 'حدث خطأ غير متوقع أثناء الرفع');
      }
    });

    xhr.addEventListener('error', () => {
      if (progressContainer) progressContainer.classList.add('hidden');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
      errorCallback('فشل الاتصال بالخادم، يرجى التحقق من حجم الملفات أو جودة الاتصال بالإنترنت');
    });

    xhr.open(method, url);
    
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    if (currentUser && currentUser.id) {
      xhr.setRequestHeader('x-user-id', currentUser.id);
    }
    
    xhr.send(formData);
  }

  if (adminEditProjectForm) {
    adminEditProjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = adminEditProjectForm.querySelector('button[type="submit"]');
      const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'حفظ التعديلات وتحديث المشروع';

      const title = document.getElementById('edit-proj-title').value;
      const category = document.getElementById('edit-proj-category').value;
      const college = document.getElementById('edit-proj-college').value;
      const description = document.getElementById('edit-proj-desc').value;
      const techUsed = document.getElementById('edit-proj-tech').value;
      const linkVal = document.getElementById('edit-proj-link').value;
      const imageInput = document.getElementById('edit-proj-image');
      const fileInput = document.getElementById('edit-proj-file');

      const formData = new FormData();
      formData.append('title', title);
      formData.append('category', category);
      formData.append('college', college);
      formData.append('description', description);
      formData.append('techUsed', techUsed);
      formData.append('link', linkVal);

      // التحقق من حجم صورة الغلاف (بحد أقصى 1.5 ميجا) ودمج العلامة المائية وتحويلها لـ Base64 لضمان الحفظ على Vercel
      if (imageInput && imageInput.files.length > 0) {
        const file = imageInput.files[0];
        if (file.size > 1.5 * 1024 * 1024) {
          window.showNotificationToast('خطأ في الحجم', 'حجم صورة الغلاف يتجاوز 1.5 ميجابايت. يرجى اختيار صورة أصغر لضمان استقرار الخادم.', 'error');
          return;
        }
        addWatermarkToImage(file).then((watermarkedBase64) => {
          formData.append('projectImageBase64', watermarkedBase64);
          proceedUpload();
        });
      } else {
        proceedUpload();
      }

      async function proceedUpload() {
        // التحقق من حجم ملف المشروع (بحد أقصى 2 ميجا للرفع المباشر) وتحويله لـ Base64 لضمان الحفظ الدائم على Vercel
        if (fileInput && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          if (file.size > 2 * 1024 * 1024) {
            window.showNotificationToast('تنبيه الحجم', 'حجم الملف يتجاوز 2 ميجابايت. للملفات الكبيرة يرجى وضع رابط تحميل خارجي (مثل Google Drive) في خانة الرابط البديل.', 'error');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            formData.append('projectFileBase64', reader.result);
            executeXhr();
          };
          reader.readAsDataURL(file);
        } else {
          executeXhr();
        }
      }

      function executeXhr() {
        const progressContainer = document.getElementById('edit-project-progress-container');
        const progressBar = document.getElementById('edit-project-progress-bar');
        const progressPercent = document.getElementById('edit-project-progress-percent');

        uploadFileWithProgress(
          `/api/projects/${activeEditProjectId}`,
          'PUT',
          formData,
          progressContainer,
          progressBar,
          progressPercent,
          submitBtn,
          originalBtnHtml,
          (data) => {
            window.showNotificationToast('تم النجاح', 'تم تعديل بيانات المشروع وحفظ التحديثات بنجاح!', 'success');
            adminEditProjectModal.classList.remove('active');
            loadArchiveData();
          },
          (errorMsg) => {
            window.showNotificationToast('فشل تعديل المشروع', errorMsg, 'error');
          }
        );
      }
    });
  }

  // إضافة مشروع جديد للأرشيف
  adminAddProjectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = adminAddProjectForm.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'رفع وإضافة المشروع للأرشيف العام للطلاب';

    const title = document.getElementById('new-proj-title').value;
    const category = document.getElementById('new-proj-category').value;
    const college = document.getElementById('new-proj-college').value;
    const description = document.getElementById('new-proj-desc').value;
    const techUsed = document.getElementById('new-proj-tech').value;
    const linkVal = document.getElementById('new-proj-link').value;
    const imageInput = document.getElementById('new-proj-image');
    const fileInput = document.getElementById('new-proj-file');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category);
    formData.append('college', college);
    formData.append('description', description);
    formData.append('techUsed', techUsed);
    formData.append('link', linkVal);

    // التحقق من حجم صورة الغلاف (بحد أقصى 1.5 ميجا) ودمج العلامة المائية وتحويلها لـ Base64 لضمان الحفظ على Vercel
    if (imageInput && imageInput.files.length > 0) {
      const file = imageInput.files[0];
      if (file.size > 1.5 * 1024 * 1024) {
        window.showNotificationToast('خطأ في الحجم', 'حجم صورة الغلاف يتجاوز 1.5 ميجابايت. يرجى اختيار صورة أصغر لضمان استقرار الخادم.', 'error');
        return;
      }
      addWatermarkToImage(file).then((watermarkedBase64) => {
        formData.append('projectImageBase64', watermarkedBase64);
        proceedUpload();
      });
    } else {
      proceedUpload();
    }

    async function proceedUpload() {
      // التحقق من حجم ملف المشروع (بحد أقصى 2 ميجا للرفع المباشر) وتحويله لـ Base64 لضمان الحفظ الدائم على Vercel
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 2 * 1024 * 1024) {
          window.showNotificationToast('تنبيه الحجم', 'حجم الملف يتجاوز 2 ميجابايت. للملفات الكبيرة يرجى وضع رابط تحميل خارجي (مثل Google Drive) في خانة الرابط البديل.', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          formData.append('projectFileBase64', reader.result);
          executeXhr();
        };
        reader.readAsDataURL(file);
      } else {
        executeXhr();
      }
    }

    function executeXhr() {
      const progressContainer = document.getElementById('add-project-progress-container');
      const progressBar = document.getElementById('add-project-progress-bar');
      const progressPercent = document.getElementById('add-project-progress-percent');

      uploadFileWithProgress(
        '/api/projects',
        'POST',
        formData,
        progressContainer,
        progressBar,
        progressPercent,
        submitBtn,
        originalBtnHtml,
        (data) => {
          window.showNotificationToast('تم النجاح', 'تم رفع وإضافة المشروع الجديد للأرشيف العام بنجاح!', 'success');
          adminAddProjectForm.reset();
          loadArchiveData();
        },
        (errorMsg) => {
          window.showNotificationToast('فشل إضافة المشروع', errorMsg, 'error');
        }
      );
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
    adminStudentsCardsContainer.innerHTML = '';
    if (students.length === 0) {
      adminStudentsCardsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary); padding: 3rem; background: rgba(255,255,255,0.01); border: 1px dashed var(--border-light); border-radius: 12px;">لا يوجد طلاب مسجلين بالمنصة حالياً.</div>`;
      return;
    }

    students.forEach(s => {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.style.cssText = `
        background: radial-gradient(circle at top right, rgba(0, 240, 255, 0.03), rgba(255, 255, 255, 0.01));
        border: 1px solid var(--border-light);
        border-radius: 16px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      `;
      
      const discountLabel = s.discountPercent > 0 
        ? `<span style="color: #ff5555; font-weight:700; background: rgba(255, 85, 85, 0.1); border: 1px solid rgba(255, 85, 85, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.75rem;">%${s.discountPercent} خصم</span>` 
        : '<span style="color: var(--text-muted); font-size: 0.8rem;">لا يوجد خصم</span>';
      
      const offerLabel = s.specialOffer 
        ? `<div style="font-size:0.75rem; color: var(--accent-gold); margin-top: 0.2rem;" title="${s.specialOffer}"><i class="fa-solid fa-gift"></i> ${s.specialOffer}</div>` 
        : '';

      const phoneLink = s.phone.startsWith('0') ? '2' + s.phone : s.phone;

      card.innerHTML = `
        <!-- خلفية متوهجة خفيفة -->
        <div style="position: absolute; top: -50px; right: -50px; width: 100px; height: 100px; background: rgba(0, 240, 255, 0.1); filter: blur(40px); border-radius: 50%; pointer-events: none;"></div>
        
        <!-- Header: Name & First Letter Avatar -->
        <div style="display: flex; align-items: center; gap: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem;">
          <div style="width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-cyan), var(--secondary-magenta)); color: #fff; font-weight: 800; font-size: 1.1rem; font-family: 'Orbitron', sans-serif; box-shadow: 0 0 10px rgba(0, 240, 255, 0.15); flex-shrink: 0;">
            ${s.name ? s.name[0].toUpperCase() : '?'}
          </div>
          <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
            <h4 style="margin: 0; font-weight: 800; font-size: 1rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.name}</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: 'Orbitron', sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.email}</span>
          </div>
        </div>

        <!-- Info Fields -->
        <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-phone"></i> الهاتف/الواتساب:</span>
            <a href="https://wa.me/${phoneLink}" target="_blank" style="color: #25d366; font-family: 'Orbitron', sans-serif; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">
              ${s.phone} <i class="fa-brands fa-whatsapp"></i>
            </a>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: flex-start; text-align: left;">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-university"></i> الكلية/التخصص:</span>
            <span style="font-weight: 700; color: #fff; text-align: right; max-width: 160px; line-height: 1.2;">${s.university} - ${s.major}</span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-muted);"><i class="fa-solid fa-tags"></i> الخصومات والعروض:</span>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end;">
              ${discountLabel}
              ${offerLabel}
            </div>
          </div>
        </div>

        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(255,255,255,0.01); padding: 0.6rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.02); text-align: center;">
          <div>
            <div style="font-size: 0.7rem; color: var(--text-muted);">إجمالي الطلبات</div>
            <div style="font-size: 1rem; font-weight: 800; font-family: 'Orbitron', sans-serif; color: var(--primary-cyan); margin-top: 0.2rem;">${s.ordersCount}</div>
          </div>
          <div style="border-right: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 0.7rem; color: var(--text-muted);">إجمالي المدفوعات</div>
            <div style="font-size: 1.05rem; font-weight: 800; font-family: 'Orbitron', sans-serif; color: var(--accent-gold); margin-top: 0.2rem;">${s.totalSpent} EGP</div>
          </div>
        </div>

        <!-- Actions Panel -->
        <div style="display: flex; gap: 0.5rem; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.8rem;">
          <button class="btn btn-outline btn-xs btn-admin-student-privileges" data-id="${s.id}" style="flex: 1; color: var(--accent-gold); border-color: rgba(255, 215, 0, 0.25); display: inline-flex; justify-content: center; align-items: center; gap: 0.3rem; font-size: 0.75rem; padding: 0.4rem 0;">
            <i class="fa-solid fa-gift"></i> الامتيازات
          </button>
          <button class="btn btn-outline btn-xs btn-admin-delete-student" data-id="${s.id}" style="flex: 1; color: var(--secondary-magenta); border-color: rgba(255, 0, 127, 0.25); display: inline-flex; justify-content: center; align-items: center; gap: 0.3rem; font-size: 0.75rem; padding: 0.4rem 0;">
            <i class="fa-solid fa-trash"></i> حذف
          </button>
        </div>
      `;
      adminStudentsCardsContainer.appendChild(card);
    });

    // ربط مستمعات تعديل الامتيازات
    document.querySelectorAll('.btn-admin-student-privileges').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        openStudentPrivilegesModal(id);
      });
    });

    // ربط أزرار حذف الطلاب
    document.querySelectorAll('.btn-admin-delete-student').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const student = allStudents.find(s => s.id === id);
        if (!student) return;

        if (confirm(`هل أنت متأكد من حذف الطالب "${student.name}" نهائياً من النظام؟\nتنبيه: سيتم حذف حسابه وجميع طلباته المرتبطة به ولا يمكن التراجع عن هذا الإجراء.`)) {
          try {
            const response = await fetch(`/api/students/${id}`, {
              method: 'DELETE'
            });
            const data = await response.json();
            if (response.ok) {
              window.showNotificationToast('تم الحذف', 'تم حذف حساب الطالب وطلباته بنجاح.', 'success');
              await loadStudentsData();
            } else {
              window.showNotificationToast('خطأ', data.error || 'فشل حذف الطالب.', 'error');
            }
          } catch (err) {
            console.error(err);
            window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
          }
        }
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
          window.showNotificationToast('خطأ', data.error || 'حدث خطأ أثناء تعديل الامتيازات.', 'error');
          return;
        }

        window.showNotificationToast('تم النجاح', 'تم تعديل وحفظ امتيازات الطالب بنجاح! ستظهر له في حسابه فوراً.', 'success');
        adminStudentPrivilegesModal.classList.remove('active');
        loadStudentsData(); // إعادة تحميل الجدول
      } catch (err) {
        console.error(err);
        window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
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
        window.showNotificationToast('تم الحذف بنجاح', 'تم حذف القسم بنجاح.', 'success');
        await loadCategoriesPanel();
      } else {
        window.showNotificationToast('فشل الحذف', 'فشل عملية حذف القسم.', 'error');
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
          window.showNotificationToast('تم النجاح', 'تم إضافة القسم الجديد بنجاح!', 'success');
          document.getElementById('new-cat-label').value = '';
          await loadCategoriesPanel();
        } else {
          window.showNotificationToast('خطأ', data.error || 'حدث خطأ أثناء إضافة القسم.', 'error');
        }
      } catch (err) {
        console.error(err);
        window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
      }
    });
  }

  // ----------------------------------------------------
  // 6. إدارة الإعلانات والتنبيهات (Admin Announcements)
  // ----------------------------------------------------
  let allAnnouncements = [];
  const adminAddAnnouncementForm = document.getElementById('admin-add-announcement-form');
  const adminAnnouncementsListTable = document.getElementById('admin-announcements-list-table');
  const btnSubmitAnnouncement = document.getElementById('btn-submit-announcement');
  const btnCancelAnnouncementEdit = document.getElementById('btn-cancel-announcement-edit');

  async function fetchAnnouncements() {
    try {
      const response = await fetch('/api/admin/announcements');
      if (!response.ok) return;
      allAnnouncements = await response.json();
      renderAnnouncementsTable();
    } catch (err) {
      console.error('Error fetching announcements:', err);
    }
  }

  function renderAnnouncementsTable() {
    if (!adminAnnouncementsListTable) return;
    adminAnnouncementsListTable.innerHTML = '';

    if (allAnnouncements.length === 0) {
      adminAnnouncementsListTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">لا توجد إعلانات مضافة حالياً.</td></tr>`;
      return;
    }

    allAnnouncements.forEach((ann, index) => {
      const tr = document.createElement('tr');
      const createdDate = new Date(ann.createdAt).toLocaleDateString('ar-EG');
      const statusBadge = ann.active 
        ? `<span class="badge badge-success">نشط</span>` 
        : `<span class="badge badge-pending">غير نشط</span>`;

      tr.innerHTML = `
        <td style="font-weight: 600; text-align: right;">${ann.title}</td>
        <td>${ann.durationDays} يوم</td>
        <td style="font-family: 'Orbitron', sans-serif;">${ann.order}</td>
        <td>${statusBadge}</td>
        <td>${createdDate}</td>
        <td>
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn btn-outline btn-xs btn-edit-ann" data-id="${ann.id}" title="تعديل"><i class="fa-solid fa-edit"></i></button>
            <button class="btn btn-outline btn-xs btn-delete-ann" data-id="${ann.id}" style="color: #ff5555; border-color: rgba(255, 85, 85, 0.25);" title="حذف"><i class="fa-solid fa-trash"></i></button>
            <button class="btn btn-outline btn-xs btn-move-up" data-id="${ann.id}" data-index="${index}" title="رفع الترتيب للأعلى"><i class="fa-solid fa-chevron-up"></i></button>
            <button class="btn btn-outline btn-xs btn-move-down" data-id="${ann.id}" data-index="${index}" title="خفض الترتيب للأسفل"><i class="fa-solid fa-chevron-down"></i></button>
          </div>
        </td>
      `;
      adminAnnouncementsListTable.appendChild(tr);
    });

    // ربط مستمعات الأحداث
    document.querySelectorAll('.btn-edit-ann').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        loadAnnouncementToEdit(id);
      });
    });

    document.querySelectorAll('.btn-delete-ann').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) {
          await deleteAnnouncement(id);
        }
      });
    });

    document.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        if (index > 0) {
          await swapAnnouncementsOrder(index, index - 1);
        }
      });
    });

    document.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const index = parseInt(e.currentTarget.getAttribute('data-index'));
        if (index < allAnnouncements.length - 1) {
          await swapAnnouncementsOrder(index, index + 1);
        }
      });
    });
  }

  function loadAnnouncementToEdit(id) {
    const ann = allAnnouncements.find(a => a.id === id);
    if (!ann) return;

    document.getElementById('announcement-id-edit').value = ann.id;
    document.getElementById('announcement-title-input').value = ann.title;
    document.getElementById('announcement-content-input').value = ann.content;
    document.getElementById('announcement-duration-input').value = ann.durationDays;
    document.getElementById('announcement-order-input').value = ann.order;
    document.getElementById('announcement-active-input').checked = ann.active;
    
    // التعبئة للميزات المتقدمة
    document.getElementById('announcement-type-input').value = ann.type || 'normal';
    document.getElementById('announcement-code-input').value = ann.discountCode || '';
    document.getElementById('announcement-percent-input').value = ann.discountPercent || '';
    document.getElementById('announcement-promo-only-input').checked = !!ann.isPromoOnly;

    btnSubmitAnnouncement.innerHTML = `حفظ التعديلات <i class="fa-solid fa-save"></i>`;
    btnCancelAnnouncementEdit.classList.remove('hidden');
    
    // التمرير لأعلى النموذج
    adminAddAnnouncementForm.scrollIntoView({ behavior: 'smooth' });
  }

  function resetAnnouncementForm() {
    document.getElementById('announcement-id-edit').value = '';
    document.getElementById('announcement-title-input').value = '';
    document.getElementById('announcement-content-input').value = '';
    document.getElementById('announcement-duration-input').value = '';
    document.getElementById('announcement-order-input').value = '0';
    document.getElementById('announcement-active-input').checked = true;

    // تهيئة حقول الميزات المتقدمة
    document.getElementById('announcement-type-input').value = 'normal';
    document.getElementById('announcement-code-input').value = '';
    document.getElementById('announcement-percent-input').value = '';
    document.getElementById('announcement-promo-only-input').checked = false;

    btnSubmitAnnouncement.innerHTML = `إضافة إعلان جديد <i class="fa-solid fa-plus"></i>`;
    btnCancelAnnouncementEdit.classList.add('hidden');
  }

  if (btnCancelAnnouncementEdit) {
    btnCancelAnnouncementEdit.addEventListener('click', resetAnnouncementForm);
  }

  if (adminAddAnnouncementForm) {
    adminAddAnnouncementForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('announcement-id-edit').value;
      const title = document.getElementById('announcement-title-input').value;
      const content = document.getElementById('announcement-content-input').value;
      const durationDays = document.getElementById('announcement-duration-input').value;
      const order = document.getElementById('announcement-order-input').value;
      const active = document.getElementById('announcement-active-input').checked;

      const type = document.getElementById('announcement-type-input').value;
      const discountCode = document.getElementById('announcement-code-input').value;
      const discountPercent = document.getElementById('announcement-percent-input').value;
      const isPromoOnly = document.getElementById('announcement-promo-only-input').checked;

      const payload = { title, content, durationDays, order, active, type, discountCode, discountPercent, isPromoOnly };
      const url = id ? `/api/admin/announcements/${id}` : '/api/admin/announcements';
      const method = id ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (response.ok) {
          window.showNotificationToast('تم النجاح', id ? 'تم تعديل الإعلان بنجاح!' : 'تم إضافة الإعلان بنجاح!', 'success');
          resetAnnouncementForm();
          await fetchAnnouncements();
        } else {
          window.showNotificationToast('خطأ', data.error || 'فشل حفظ الإعلان.', 'error');
        }
      } catch (err) {
        console.error(err);
        window.showNotificationToast('خطأ في الاتصال', 'خطأ في الاتصال بالخادم.', 'error');
      }
    });
  }

  async function deleteAnnouncement(id) {
    try {
      const response = await fetch(`/api/admin/announcements/${id}`, { method: 'DELETE' });
      if (response.ok) {
        window.showNotificationToast('تم الحذف', 'تم حذف الإعلان بنجاح.', 'success');
        await fetchAnnouncements();
      } else {
        const data = await response.json();
        window.showNotificationToast('خطأ', data.error || 'فشل حذف الإعلان.', 'error');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function swapAnnouncementsOrder(indexA, indexB) {
    const annA = allAnnouncements[indexA];
    const annB = allAnnouncements[indexB];

    // تبديل قيم الترتيب (order)
    const tempOrder = annA.order;
    
    try {
      // إرسال تعديل للأول
      await fetch(`/api/admin/announcements/${annA.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: annB.order })
      });
      // إرسال تعديل للثاني
      await fetch(`/api/admin/announcements/${annB.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: tempOrder })
      });
      
      await fetchAnnouncements();
    } catch (err) {
      console.error('Error swapping announcement order:', err);
    }
  }

  // ----------------------------------------------------
  // 7. إدارة وعرض تقييمات مشاريع المعرض
  // ----------------------------------------------------
  const adminProjectRatingsTableBody = document.getElementById('admin-project-ratings-table-body');

  async function fetchProjectRatings() {
    try {
      const response = await fetch('/api/admin/project-ratings');
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          window.showNotificationToast('غير مصرح', 'غير مصرح لك بمشاهدة هذه التقييمات!', 'error');
        }
        return;
      }
      const ratings = await response.json();
      renderProjectRatingsTable(ratings);
    } catch (err) {
      console.error('Error fetching project ratings:', err);
    }
  }

  function renderProjectRatingsTable(ratings) {
    if (!adminProjectRatingsTableBody) return;
    adminProjectRatingsTableBody.innerHTML = '';

    if (ratings.length === 0) {
      adminProjectRatingsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">لا توجد تقييمات مسجلة للمشاريع حالياً.</td></tr>`;
      return;
    }

    ratings.forEach(r => {
      const tr = document.createElement('tr');
      const formattedDate = new Date(r.createdAt).toLocaleDateString('ar-EG');
      
      // رسم النجوم الذهبية للتقييم
      let starsHtml = '';
      for (let i = 1; i <= 5; i++) {
        if (i <= r.rating) {
          starsHtml += '<i class="fa-solid fa-star" style="color: var(--accent-gold); font-size: 0.8rem; margin: 0 1px;"></i>';
        } else {
          starsHtml += '<i class="fa-regular fa-star" style="color: var(--text-muted); font-size: 0.8rem; margin: 0 1px;"></i>';
        }
      }

      tr.innerHTML = `
        <td style="font-weight: 600;">${r.projectTitle || 'مشروع محذوف أو غير معرف'}</td>
        <td><div style="direction: ltr; display: inline-block;">${starsHtml}</div></td>
        <td>${r.visitorName || 'زائر مجهول'}</td>
        <td style="font-family: 'Orbitron', sans-serif; font-size: 0.8rem;">${r.visitorEmail || '-'}</td>
        <td style="color: var(--text-secondary); font-size: 0.85rem; max-width: 250px; white-space: normal; line-height: 1.5;">${r.comment || '-'}</td>
        <td>${formattedDate}</td>
      `;
      adminProjectRatingsTableBody.appendChild(tr);
    });
  }

  // ----------------------------------------------------
  // 8. نظام اختيار وتبديل الثيمات المظهرية للأدمن البسيط (Light/Dark Mode)
  // ----------------------------------------------------
  const btnToggleDarkMode = document.getElementById('btn-toggle-dark-mode');
  const toggleModeIcon = document.getElementById('toggle-mode-icon');

  function setThemeMode(isLight) {
    if (isLight) {
      document.body.classList.add('light-mode');
      if (toggleModeIcon) {
        toggleModeIcon.className = 'fa-solid fa-sun';
        toggleModeIcon.style.color = '#ffb000';
      }
      localStorage.setItem('themeMode', 'light');
    } else {
      document.body.classList.remove('light-mode');
      if (toggleModeIcon) {
        toggleModeIcon.className = 'fa-solid fa-moon';
        toggleModeIcon.style.color = '';
      }
      localStorage.setItem('themeMode', 'dark');
    }

    // تحديث ألوان المخططات البيانية بالثيم الجديد
    if (allRequests && allRequests.length > 0) {
      setTimeout(() => renderDashboardCharts(allRequests), 100);
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
  // 8.5 خلفية النجوم التفاعلية المضيئة للأدمن
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
  // 9. المخططات البيانية التفاعلية (Chart.js Dashboard)
  // ----------------------------------------------------
  let revenueChartInstance = null;
  let categoriesChartInstance = null;

  function renderDashboardCharts(requests) {
    const monthlyRevenue = {};
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    
    const currentMonth = new Date().getMonth();
    for (let i = 0; i <= currentMonth; i++) {
      monthlyRevenue[months[i]] = 0;
    }

    requests.forEach(r => {
      if (r.status === 'completed' || r.status === 'paid') {
        const date = new Date(r.createdAt || Date.now());
        const mName = months[date.getMonth()];
        if (monthlyRevenue[mName] !== undefined) {
          monthlyRevenue[mName] += (r.price || 0);
        }
      }
    });

    const revenueLabels = Object.keys(monthlyRevenue);
    const revenueValues = Object.values(monthlyRevenue);

    const categoryCounts = {};
    requests.forEach(r => {
      const cat = r.category || 'غير مصنف';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    const categoryLabels = Object.keys(categoryCounts);
    const categoryValues = Object.values(categoryCounts);

    const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-cyan').trim() || '#00f0ff';
    const secondaryColor = getComputedStyle(document.body).getPropertyValue('--secondary-magenta').trim() || '#ff007f';
    const accentColor = getComputedStyle(document.body).getPropertyValue('--accent-gold').trim() || '#d4af37';
    const textColor = '#f1f5f9';

    const ctxRevenue = document.getElementById('revenueLineChart');
    if (ctxRevenue) {
      if (revenueChartInstance) {
        revenueChartInstance.destroy();
      }
      revenueChartInstance = new Chart(ctxRevenue, {
        type: 'line',
        data: {
          labels: revenueLabels,
          datasets: [{
            label: 'إجمالي الأرباح المستلمة',
            data: revenueValues,
            borderColor: primaryColor,
            backgroundColor: 'rgba(0, 240, 255, 0.05)',
            borderWidth: 3,
            pointBackgroundColor: secondaryColor,
            pointBorderColor: '#fff',
            pointRadius: 5,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: textColor, font: { family: 'Cairo' } }
            },
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { family: 'Cairo' } }
            }
          }
        }
      });
    }

    const ctxCategories = document.getElementById('categoriesPieChart');
    if (ctxCategories) {
      if (categoriesChartInstance) {
        categoriesChartInstance.destroy();
      }
      categoriesChartInstance = new Chart(ctxCategories, {
        type: 'doughnut',
        data: {
          labels: categoryLabels,
          datasets: [{
            data: categoryValues,
            backgroundColor: [
              primaryColor,
              secondaryColor,
              accentColor,
              '#10b981',
              '#8b5cf6',
              '#f59e0b'
            ],
            borderWidth: 1,
            borderColor: 'rgba(0,0,0,0.5)'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textColor, font: { family: 'Cairo', size: 10 } }
            }
          },
          cutout: '65%'
        }
      });
    }
  }

  // ----------------------------------------------------
  // تشغيل الإحصائيات لأول مرة عند تحميل الملف
  loadOverviewStats();
});
