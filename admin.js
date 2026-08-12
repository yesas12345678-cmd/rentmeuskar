const initAdmin = () => {
    
    // VARIABLES DE ESTADO
    let bookings = [];
    let selectedBooking = null;

    // ELEMENTOS DE AUTENTICACIÓN
    const loginLayout = document.getElementById('admin-login-layout');
    const dashboardLayout = document.getElementById('admin-dashboard-layout');
    const loginForm = document.getElementById('admin-login-form');
    const btnAdminLogout = document.getElementById('btn-admin-logout');

    // ELEMENTOS DEL DOM
    const tbody = document.getElementById('bookings-tbody');
    const btnRefresh = document.getElementById('btn-refresh');
    
    // Elementos KPI
    const kpiTotal = document.getElementById('kpi-total');
    const kpiPending = document.getElementById('kpi-pending');
    const kpiRevenue = document.getElementById('kpi-revenue');
    
    // Controles de Filtrado
    const searchName = document.getElementById('search-name');
    const filterVan = document.getElementById('filter-van');
    const filterStatus = document.getElementById('filter-status');
    
    // Elementos del Modal
    const modal = document.getElementById('details-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalClientName = document.getElementById('modal-client-name');
    const modalBookingId = document.getElementById('modal-booking-id');
    const modalStatusBadge = document.getElementById('modal-status-badge');
    const modalVanName = document.getElementById('modal-van-name');
    const modalPickupDate = document.getElementById('modal-pickup-date');
    const modalReturnDate = document.getElementById('modal-return-date');
    const modalDuration = document.getElementById('modal-duration');
    const modalRentalMode = document.getElementById('modal-rental-mode');
    const modalEstimatedKmsRow = document.getElementById('modal-estimated-kms-row');
    const modalEstimatedKms = document.getElementById('modal-estimated-kms');
    const modalWaitingHoursRow = document.getElementById('modal-waiting-hours-row');
    const modalWaitingHours = document.getElementById('modal-waiting-hours');
    const modalExtrasSectionRow = document.getElementById('modal-extras-section-row');
    const modalExtrasList = document.getElementById('modal-extras-list');
    
    // Nuevos campos en modal
    const modalPaymentStatus = document.getElementById('modal-payment-status');
    const modalFianzaStatus = document.getElementById('modal-fianza-status');
    const modalPaymentRefRow = document.getElementById('modal-payment-ref-row');
    const modalPaymentRef = document.getElementById('modal-payment-ref');
    const modalDocsRow = document.getElementById('modal-docs-row');
    const modalBtnContract = document.getElementById('modal-btn-contract');
    const modalBtnInvoice = document.getElementById('modal-btn-invoice');
    
    // Elementos de fotos
    const modalPhotosBefore = document.getElementById('modal-photos-before');
    const modalPhotosAfter = document.getElementById('modal-photos-after');
    const inputUploadBefore = document.getElementById('input-upload-before');
    const inputUploadAfter = document.getElementById('input-upload-after');
    const btnTriggerBefore = document.getElementById('btn-trigger-before');
    const btnTriggerAfter = document.getElementById('btn-trigger-after');

    const modalCreatedAt = document.getElementById('modal-created-at');
    const modalTotalPrice = document.getElementById('modal-total-price');
    const modalActionsFooter = document.getElementById('modal-actions-footer');
    
    // Toast Container
    const toastContainer = document.getElementById('toast-container');

    // Elementos de la Pestaña de Flota
    const tabBookings = document.getElementById('tab-bookings');
    const tabFleet = document.getElementById('tab-fleet');
    const sectionBookings = document.getElementById('section-bookings');
    const sectionFleet = document.getElementById('section-fleet');
    const fleetTbody = document.getElementById('fleet-tbody');
    const btnAddVan = document.getElementById('btn-add-van');
    
    // Modal de furgonetas
    const vanModal = document.getElementById('van-modal');
    const vanModalCloseBtn = document.getElementById('van-modal-close-btn');
    const vanForm = document.getElementById('van-form');
    const vanFormId = document.getElementById('van-form-id');
    const vanFormType = document.getElementById('van-form-type');
    const vanFormName = document.getElementById('van-form-name');
    const vanFormPlate = document.getElementById('van-form-plate');
    const vanFormM3 = document.getElementById('van-form-m3');
    const vanFormPriceSin = document.getElementById('van-form-price-sin');
    const vanFormMinPriceCon = document.getElementById('van-form-min-price-con');
    const vanFormKmPriceCon = document.getElementById('van-form-km-price-con');
    const vanFormExtraName = document.getElementById('van-form-extra-name');
    const vanFormExtraPrice = document.getElementById('van-form-extra-price');
    const vanFormExtraType = document.getElementById('van-form-extra-type');
    const btnAddVanExtra = document.getElementById('btn-add-van-extra');
    const vanExtrasPreviewTbody = document.getElementById('van-extras-preview-tbody');
    const vanFormStatus = document.getElementById('van-form-status');
    const vanBtnCancel = document.getElementById('van-btn-cancel');
    const vanModalTitle = document.getElementById('van-modal-title');
    const vanFormImagesInput = document.getElementById('van-form-images-input');
    const vanBtnUploadTrigger = document.getElementById('van-btn-upload-trigger');
    const vanImagesPreviewGrid = document.getElementById('van-images-preview-grid');

    // Elementos de la Pestaña de Configuración
    const tabSettings = document.getElementById('tab-settings');
    const sectionSettings = document.getElementById('section-settings');
    const settingsHoursForm = document.getElementById('settings-hours-form');
    const settingHoursWeekdays = document.getElementById('setting-hours-weekdays');
    const settingHoursSaturdays = document.getElementById('setting-hours-saturdays');
    const settingHoursSundays = document.getElementById('setting-hours-sundays');
    
    // Elementos de Reseñas / Códigos
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const generatedCodeBox = document.getElementById('generated-code-box');
    const generatedCodeText = document.getElementById('generated-code-text');
    const adminReviewsTbody = document.getElementById('admin-reviews-tbody');
    
    // Variables de Estado de Flota
    let fleet = [];
    let currentVanImages = [];
    let newVanFiles = [];
    let currentVanExtras = [];

    /* ==========================================================================
       1. AUTENTICACIÓN
       ========================================================================== */
    const checkAuth = () => {
        const token = localStorage.getItem('admin_token');
        if (token === 'admin_token_rentmeuskar') {
            loginLayout.style.display = 'none';
            dashboardLayout.style.display = 'block';
            fetchBookings();
            fetchFleet();
        } else {
            loginLayout.style.display = 'flex';
            dashboardLayout.style.display = 'none';
        }
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-username').value;
        const password = document.getElementById('admin-password').value;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            if (response.ok && data.user && data.user.is_admin) {
                localStorage.setItem('admin_token', data.token);
                showToast('Bienvenido, Manuel.', 'success');
                checkAuth();
            } else {
                showToast(data.error || 'Credenciales inválidas.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error al conectar con el servidor.', 'error');
        }
    });

    btnAdminLogout.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        showToast('Sesión cerrada correctamente.', 'info');
        checkAuth();
    });

    /* ==========================================================================
       2. UTILIDADES Y FORMATO
       ========================================================================== */
    
    // Formatear Fecha (YYYY-MM-DD -> DD/MM/YYYY)
    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const cleanDate = dateStr.split('T')[0];
        const [year, month, day] = cleanDate.split('-');
        return `${day}/${month}/${year}`;
    };

    // Formatear Timestamp Completo
    const formatTimestamp = (timestampStr) => {
        if (!timestampStr) return '-';
        const date = new Date(timestampStr);
        return date.toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Formatear Euros
    const formatCurrency = (amount) => {
        const value = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value || 0);
    };

    // Mostrar Notificación Toast
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'fa-info-circle';
        if (type === 'success') icon = 'fa-check-circle';
        if (type === 'error') icon = 'fa-exclamation-circle';
        
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        toast.offsetHeight; // trigger reflow
        toast.classList.add('active');
        
        setTimeout(() => {
            toast.classList.remove('active');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3500);
    };

    /* ==========================================================================
       3. CONEXIÓN API Y DATOS
       ========================================================================== */

    // Obtener todas las reservas
    const fetchBookings = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        try {
            const response = await fetch('/api/bookings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al obtener datos del servidor');
            
            bookings = await response.json();
            
            updateKPIs();
            renderBookings();
        } catch (err) {
            console.error(err);
            showToast('Error al conectar con la base de datos.', 'error');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 3rem; color: var(--color-danger);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 1rem; display: block;"></i>
                        No se pudo conectar a la base de datos.
                    </td>
                </tr>
            `;
        }
    };

    // Actualizar KPIs en base a los datos obtenidos
    const updateKPIs = () => {
        kpiTotal.textContent = bookings.length;
        
        const pendingCount = bookings.filter(b => b.status === 'pending').length;
        kpiPending.textContent = pendingCount;
        
        const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
        const revenue = confirmedBookings.reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);
        kpiRevenue.textContent = formatCurrency(revenue);
    };

    // Actualizar Estado en la API (soporta status, fianza_status, payment_status)
    const updateBookingInApi = async (id, fields) => {
        const token = localStorage.getItem('admin_token');
        try {
            const response = await fetch(`/api/bookings/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(fields)
            });

            if (!response.ok) throw new Error('Error al actualizar reserva');
            const data = await response.json();
            
            // Actualizar localmente
            bookings = bookings.map(b => b.id === parseInt(id) ? { ...b, ...data.booking } : b);
            
            updateKPIs();
            renderBookings();
            
            // Si el modal está abierto, refrescarlo
            if (selectedBooking && selectedBooking.id === parseInt(id)) {
                const updated = bookings.find(b => b.id === parseInt(id));
                openModal(updated);
            }
            
            showToast(`Reserva #${id} actualizada con éxito.`, 'success');
        } catch (err) {
            console.error(err);
            showToast('No se pudo actualizar la reserva.', 'error');
        }
    };

    // Eliminar reserva
    const deleteBooking = async (id) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente la reserva #${id}? Se borrarán también los registros asociados.`)) {
            return;
        }

        const token = localStorage.getItem('admin_token');
        try {
            const response = await fetch(`/api/bookings/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Error al eliminar reserva');
            
            bookings = bookings.filter(b => b.id !== parseInt(id));
            
            updateKPIs();
            renderBookings();
            closeModal();
            
            showToast(`Reserva #${id} eliminada permanentemente.`, 'success');
        } catch (err) {
            console.error(err);
            showToast('No se pudo eliminar la reserva.', 'error');
        }
    };

    /* ==========================================================================
       4. RENDERIZADO Y CONTROL DEL DOM
       ========================================================================== */

    // Renderizar la tabla de reservas con filtros
    const renderBookings = () => {
        const query = searchName.value.toLowerCase().trim();
        const vanFilter = filterVan.value;
        const statusFilter = filterStatus.value;
        
        const filteredBookings = bookings.filter(booking => {
            const clientNameVal = (booking.client_name || booking.name).toLowerCase();
            const matchesName = clientNameVal.includes(query);
            const matchesVan = vanFilter === 'all' || booking.van_type === vanFilter;
            const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
            return matchesName && matchesVan && matchesStatus;
        });

        if (filteredBookings.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8">
                        <div class="empty-state">
                            <i class="fa-solid fa-calendar-xmark"></i>
                            <h3>No se encontraron reservas</h3>
                            <p>Intenta ajustar los criterios de búsqueda o filtros.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        filteredBookings.forEach(booking => {
            const tr = document.createElement('tr');
            tr.dataset.id = booking.id;
            tr.style.cursor = 'pointer';
            
            const vanClass = booking.van_type === 'medium' ? 'medium' : 'large';
            const vanIcon = booking.van_type === 'medium' ? 'fa-truck-front' : 'fa-truck-moving';
            const vanSimpleName = booking.van_type === 'medium' ? 'Ford Transit' : 'MAN TGE';
            const modeBadge = booking.rental_mode === 'con' 
                ? '<span style="font-size:0.7rem; padding:2px 4px; border-radius:3px; background:rgba(0,210,255,0.1); color:#00d2ff; margin-left:0.3rem;"><i class="fa-solid fa-user-tie"></i> Con Driver</span>' 
                : '<span style="font-size:0.7rem; padding:2px 4px; border-radius:3px; background:rgba(130,209,5,0.1); color:#82d105; margin-left:0.3rem;"><i class="fa-solid fa-key"></i> Sin Driver</span>';
            
            const clientNameVal = booking.client_name || booking.name;
            
            tr.innerHTML = `
                <td>
                    <div class="client-cell">
                        <span class="client-name">${escapeHTML(clientNameVal)}</span>
                        <span class="client-date">ID: #${booking.id} • ${formatTimestamp(booking.created_at)}</span>
                    </div>
                </td>
                <td>
                    <span class="van-badge ${vanClass}">
                        <i class="fa-solid ${vanIcon}"></i> ${vanSimpleName}
                    </span>
                    ${modeBadge}
                </td>
                <td class="date-cell">
                    ${formatDate(booking.pickup_date)}
                    <span class="time"><i class="fa-regular fa-clock"></i> ${booking.pickup_time}</span>
                </td>
                <td class="date-cell">
                    ${formatDate(booking.return_date)}
                    <span class="time"><i class="fa-regular fa-clock"></i> ${booking.return_time}</span>
                </td>
                <td style="text-align: center;">${booking.days} ${booking.days === 1 ? 'día' : 'días'}</td>
                <td>
                    <span class="price-value">${formatCurrency(booking.total_price)}</span>
                </td>
                <td>
                    <span class="status-badge ${booking.status}">
                        ${booking.status === 'pending' ? 'Pendiente' : booking.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
                    </span>
                </td>
                <td>
                    <div class="actions-cell">
                        ${booking.status !== 'confirmed' ? `
                            <button class="btn-icon confirm" data-action="confirm" title="Confirmar Reserva">
                                <i class="fa-solid fa-check"></i>
                            </button>
                        ` : ''}
                        ${booking.status !== 'cancelled' ? `
                            <button class="btn-icon cancel" data-action="cancel" title="Cancelar Reserva">
                                <i class="fa-solid fa-ban"></i>
                            </button>
                        ` : ''}
                        <button class="btn-icon delete" data-action="delete" title="Eliminar Reserva">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            `;
            
            tr.addEventListener('click', (e) => {
                const actionButton = e.target.closest('.btn-icon');
                if (actionButton) {
                    const action = actionButton.dataset.action;
                    if (action === 'confirm') updateBookingInApi(booking.id, { status: 'confirmed' });
                    if (action === 'cancel') updateBookingInApi(booking.id, { status: 'cancelled' });
                    if (action === 'delete') deleteBooking(booking.id);
                } else {
                    openModal(booking);
                }
            });

            tbody.appendChild(tr);
        });
    };

    const escapeHTML = (str) => {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    };

    /* ==========================================================================
       5. MODAL DE DETALLES
       ========================================================================== */

    const openModal = (booking) => {
        selectedBooking = booking;
        
        modalClientName.textContent = booking.client_name || booking.name;
        modalBookingId.textContent = `#${booking.id}`;
        
        modalStatusBadge.className = `status-badge ${booking.status}`;
        modalStatusBadge.textContent = booking.status === 'pending' ? 'Pendiente' : booking.status === 'confirmed' ? 'Confirmado' : 'Cancelado';
        
        modalVanName.textContent = booking.van_name;
        modalPickupDate.innerHTML = `${formatDate(booking.pickup_date)} a las <strong>${booking.pickup_time}</strong>`;
        modalReturnDate.innerHTML = `${formatDate(booking.return_date)} a las <strong>${booking.return_time}</strong>`;
        modalDuration.textContent = booking.rental_mode === 'con' ? '-' : `${booking.days} ${booking.days === 1 ? 'día' : 'días'}`;
        
        // Modalidad con/sin conductor
        modalRentalMode.textContent = booking.rental_mode === 'con' ? 'CON CONDUCTOR' : 'SIN CONDUCTOR';
        if (booking.rental_mode === 'con') {
            modalEstimatedKmsRow.style.display = 'flex';
            modalEstimatedKms.textContent = `${booking.estimated_kms} km`;
            modalWaitingHoursRow.style.display = 'flex';
            modalWaitingHours.textContent = `${booking.waiting_hours} h`;
            modalExtrasSectionRow.style.display = 'none';
        } else {
            modalEstimatedKmsRow.style.display = 'none';
            modalWaitingHoursRow.style.display = 'none';
            modalExtrasSectionRow.style.display = 'flex';
        }

        modalCreatedAt.textContent = formatTimestamp(booking.created_at);
        modalTotalPrice.textContent = formatCurrency(booking.total_price);
        
        // Extras
        modalExtrasList.innerHTML = '';
        if (booking.extras && booking.extras.length > 0) {
            booking.extras.forEach(extra => {
                const li = document.createElement('li');
                li.innerHTML = `<i class="fa-solid fa-square-plus" style="color: var(--color-neon);"></i> ${extra}`;
                modalExtrasList.appendChild(li);
            });
        } else {
            modalExtrasList.innerHTML = '<li>Sin extras adicionales</li>';
        }
        
        // Campos nuevos
        const paymentLabel = booking.payment_status === 'paid' ? 'PAGADO' : 'PENDIENTE';
        modalPaymentStatus.innerHTML = `<span style="font-weight:700; color:${booking.payment_status === 'paid' ? '#82d105' : '#ffb703'};">${paymentLabel}</span>`;
        
        const fianzaLabel = booking.fianza_status === 'paid' ? 'RETENIDA (500€)' : booking.fianza_status === 'refunded' ? 'DEVUELTA' : 'PENDIENTE';
        modalFianzaStatus.innerHTML = `<span style="font-weight:700; color:${booking.fianza_status === 'paid' ? '#00d2ff' : booking.fianza_status === 'refunded' ? '#82d105' : '#ffb703'};">${fianzaLabel}</span>`;
        
        if (booking.payment_status === 'paid' && booking.payment_id) {
            modalPaymentRefRow.style.display = 'flex';
            modalPaymentRef.textContent = booking.payment_id;
        } else {
            modalPaymentRefRow.style.display = 'none';
        }

        // Mostrar botones de documentación si es confirmed
        if (booking.status === 'confirmed') {
            modalDocsRow.style.display = 'flex';
            modalBtnContract.onclick = () => window.open(`/contract/${booking.id}`, '_blank');
            modalBtnInvoice.onclick = () => window.open(`/invoice/${booking.id}`, '_blank');
        } else {
            modalDocsRow.style.display = 'none';
        }

        // Cargar fotos antes/después
        renderPhotosList(booking.photos_before || [], modalPhotosBefore);
        renderPhotosList(booking.photos_after || [], modalPhotosAfter);
        
        // Inyectar botones dinámicos en el footer
        const phone = booking.client_phone || '34614767411';
        modalActionsFooter.innerHTML = `
            <a href="https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(`Hola ${booking.client_name || booking.name}, te escribo de RentMeUskar acerca de tu reserva #${booking.id}...`)}" target="_blank" class="btn" style="background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25d366;">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </a>
            ${booking.status !== 'confirmed' ? `
                <button class="btn btn-primary" id="modal-btn-confirm">
                    <i class="fa-solid fa-check"></i> Confirmar
                </button>
            ` : ''}
            
            ${booking.fianza_status === 'paid' ? `
                <button class="btn" style="border-color: var(--color-info); color: var(--color-info);" id="modal-btn-refund-fianza">
                    <i class="fa-solid fa-hand-holding-dollar"></i> Devolver Fianza
                </button>
            ` : ''}

            ${booking.payment_status === 'pending' ? `
                <button class="btn" style="border-color: var(--color-neon); color: var(--color-neon);" id="modal-btn-pay">
                    <i class="fa-solid fa-money-bill-wave"></i> Marcar Pagado
                </button>
            ` : ''}
            
            ${booking.status !== 'cancelled' ? `
                <button class="btn" style="border-color: var(--color-warning); color: var(--color-warning);" id="modal-btn-cancel">
                    <i class="fa-solid fa-ban"></i> Cancelar
                </button>
            ` : ''}
            <button class="btn" style="border-color: var(--color-danger); color: var(--color-danger);" id="modal-btn-delete">
                <i class="fa-solid fa-trash-can"></i> Eliminar
            </button>
        `;
        
        // Listeners footer modal
        const btnConf = document.getElementById('modal-btn-confirm');
        const btnRefund = document.getElementById('modal-btn-refund-fianza');
        const btnPay = document.getElementById('modal-btn-pay');
        const btnCanc = document.getElementById('modal-btn-cancel');
        const btnDel = document.getElementById('modal-btn-delete');
        
        if (btnConf) btnConf.addEventListener('click', () => updateBookingInApi(booking.id, { status: 'confirmed' }));
        if (btnRefund) btnRefund.addEventListener('click', () => updateBookingInApi(booking.id, { fianza_status: 'refunded' }));
        if (btnPay) btnPay.addEventListener('click', () => updateBookingInApi(booking.id, { payment_status: 'paid' }));
        if (btnCanc) btnCanc.addEventListener('click', () => updateBookingInApi(booking.id, { status: 'cancelled' }));
        if (btnDel) btnDel.addEventListener('click', () => deleteBooking(booking.id));
        
        modal.classList.add('active');
    };

    // Renderizar miniaturas de fotos y hacerlas clickables para abrir
    const renderPhotosList = (photoUrls, container) => {
        container.innerHTML = '';
        if (photoUrls.length === 0) {
            container.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted); align-self: center;">Sin fotos</span>';
            return;
        }
        
        photoUrls.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.style.width = '45px';
            img.style.height = '45px';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '4px';
            img.style.cursor = 'pointer';
            img.style.border = '1px solid rgba(255,255,255,0.1)';
            
            img.addEventListener('click', () => {
                window.open(url, '_blank');
            });
            
            container.appendChild(img);
        });
    };

    // Manejar subida de archivos (multer integration)
    const uploadFiles = async (type) => {
        if (!selectedBooking) return;
        
        const fileInput = type === 'before' ? inputUploadBefore : inputUploadAfter;
        const triggerBtn = type === 'before' ? btnTriggerBefore : btnTriggerAfter;
        
        if (fileInput.files.length === 0) return;
        
        const originalBtnHtml = triggerBtn.innerHTML;
        triggerBtn.disabled = true;
        triggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...';
        
        const formData = new FormData();
        formData.append('type', type);
        for (let i = 0; i < fileInput.files.length; i++) {
            formData.append('photos', fileInput.files[i]);
        }
        
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`/api/bookings/${selectedBooking.id}/photos`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al subir fotos');
            
            // Actualizar localmente la reserva
            bookings = bookings.map(b => b.id === selectedBooking.id ? { ...b, ...data.booking } : b);
            selectedBooking = data.booking;
            
            // Refrescar modal
            openModal(data.booking);
            showToast('Fotos subidas e inspección registrada.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al subir las imágenes.', 'error');
        } finally {
            triggerBtn.disabled = false;
            triggerBtn.innerHTML = originalBtnHtml;
            fileInput.value = ''; // limpiar input
        }
    };

    // Handlers para triggers de upload inputs
    btnTriggerBefore.addEventListener('click', () => inputUploadBefore.click());
    btnTriggerAfter.addEventListener('click', () => inputUploadAfter.click());
    
    inputUploadBefore.addEventListener('change', () => uploadFiles('before'));
    inputUploadAfter.addEventListener('change', () => uploadFiles('after'));

    const closeModal = () => {
        modal.classList.remove('active');
        selectedBooking = null;
    };

    /* ==========================================================================
       6. LISTENERS DE EVENTOS GLOBAL
       ========================================================================== */
    
    btnRefresh.addEventListener('click', () => {
        fetchBookings();
        if (sectionFleet.style.display === 'block') {
            fetchFleet();
        }
        showToast('Datos actualizados.', 'success');
    });

    searchName.addEventListener('input', renderBookings);
    filterVan.addEventListener('change', renderBookings);
    filterStatus.addEventListener('change', renderBookings);
    
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    /* ==========================================================================
       6. GESTIÓN DE FLOTA (FURGONETAS)
       ========================================================================== */
    
    // Alternar pestañas
    const switchTab = (tab) => {
        tabBookings.classList.remove('btn-primary');
        tabBookings.style.borderColor = 'rgba(255,255,255,0.08)';
        tabFleet.classList.remove('btn-primary');
        tabFleet.style.borderColor = 'rgba(255,255,255,0.08)';
        tabSettings.classList.remove('btn-primary');
        tabSettings.style.borderColor = 'rgba(255,255,255,0.08)';
        
        sectionBookings.style.display = 'none';
        sectionFleet.style.display = 'none';
        sectionSettings.style.display = 'none';
        
        if (tab === 'bookings') {
            tabBookings.classList.add('btn-primary');
            tabBookings.style.borderColor = 'var(--color-neon)';
            sectionBookings.style.display = 'block';
        } else if (tab === 'fleet') {
            tabFleet.classList.add('btn-primary');
            tabFleet.style.borderColor = 'var(--color-neon)';
            sectionFleet.style.display = 'block';
            fetchFleet();
        } else if (tab === 'settings') {
            tabSettings.classList.add('btn-primary');
            tabSettings.style.borderColor = 'var(--color-neon)';
            sectionSettings.style.display = 'block';
            fetchSettings();
            fetchReviews();
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            settingHoursWeekdays.value = data.hours_weekdays || '';
            settingHoursSaturdays.value = data.hours_saturdays || '';
            settingHoursSundays.value = data.hours_sundays || '';
        } catch (err) {
            console.error('Error al obtener configuraciones:', err);
            showToast('Error al conectar con la API de configuración.', 'error');
        }
    };

    // Obtener opiniones de compras verificadas para moderación
    const fetchReviews = async () => {
        try {
            const res = await fetch('/api/reviews');
            if (res.ok) {
                const reviews = await res.json();
                renderReviewsList(reviews);
            }
        } catch (err) {
            console.error('Error al obtener opiniones:', err);
            adminReviewsTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-danger);">
                        Error al cargar opiniones.
                    </td>
                </tr>
            `;
        }
    };

    const renderReviewsList = (reviews) => {
        if (!adminReviewsTbody) return;
        
        if (reviews.length === 0) {
            adminReviewsTbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                        No hay opiniones registradas.
                    </td>
                </tr>
            `;
            return;
        }
        
        adminReviewsTbody.innerHTML = '';
        reviews.forEach(review => {
            const tr = document.createElement('tr');
            const starsHtml = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            
            tr.innerHTML = `
                <td><strong>${review.client_name}</strong><br><small style="color:var(--text-muted);">${review.role_or_city || ''}</small></td>
                <td style="color:#ffb703; font-weight:bold; font-size:1.1rem; white-space:nowrap;">${starsHtml}</td>
                <td><code style="background:rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color:var(--color-info);">${review.booking_code}</code></td>
                <td style="max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${review.comment}">${review.comment}</td>
                <td>
                    <button class="btn-icon delete delete-review" data-id="${review.id}" title="Eliminar reseña" style="padding: 4px 8px; font-size: 0.85rem;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            
            tr.querySelector('.delete-review').addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                if (confirm('¿Estás seguro de que deseas eliminar esta opinión permanentemente de la web?')) {
                    await deleteReview(id);
                }
            });
            
            adminReviewsTbody.appendChild(tr);
        });
    };

    const deleteReview = async (id) => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        
        try {
            const res = await fetch(`/api/admin/reviews/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const data = await res.json();
            if (res.ok) {
                showToast('Opinión eliminada correctamente.', 'success');
                fetchReviews();
            } else {
                showToast(data.error || 'Error al eliminar opinión.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión al eliminar opinión.', 'error');
        }
    };

    // Generador de códigos manuales
    if (btnGenerateCode) {
        btnGenerateCode.addEventListener('click', async () => {
            const token = localStorage.getItem('admin_token');
            if (!token) return;
            
            btnGenerateCode.disabled = true;
            btnGenerateCode.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';
            
            try {
                const res = await fetch('/api/admin/generate-review-code', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await res.json();
                if (res.ok) {
                    generatedCodeBox.style.display = 'block';
                    generatedCodeText.textContent = data.code;
                    showToast('Código de opinión verificado generado con éxito.', 'success');
                } else {
                    showToast(data.error || 'Error al generar código.', 'error');
                }
            } catch (err) {
                console.error(err);
                showToast('Error de conexión al generar código.', 'error');
            } finally {
                btnGenerateCode.disabled = false;
                btnGenerateCode.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generar Nuevo Código';
            }
        });
    }

    // Obtener la flota de furgonetas
    const fetchFleet = async () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        try {
            const response = await fetch('/api/admin/vans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Error al obtener datos de la flota');
            
            fleet = await response.json();
            
            // Actualizar selector de filtrado de reservas dinámicamente
            updateFilterVanSelect();

            renderFleet();
        } catch (err) {
            console.error(err);
            showToast('Error al conectar con el catálogo de flota.', 'error');
            fleetTbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem; color: var(--color-danger);">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; margin-bottom: 1rem; display: block;"></i>
                        No se pudo conectar a la base de datos de flota.
                    </td>
                </tr>
            `;
        }
    };

    // Actualizar el select filter-van de la pestaña de reservas
    const updateFilterVanSelect = () => {
        const currentVal = filterVan.value;
        filterVan.innerHTML = '<option value="all">Todos los vehículos</option>';
        fleet.forEach(van => {
            const opt = document.createElement('option');
            opt.value = van.van_type;
            opt.textContent = `${van.name} (${van.plate})`;
            filterVan.appendChild(opt);
        });
        filterVan.value = currentVal;
    };

    // Renderizar la tabla de furgonetas
    const renderFleet = () => {
        fleetTbody.innerHTML = '';
        if (fleet.length === 0) {
            fleetTbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fa-solid fa-truck" style="font-size: 2.5rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                        No hay furgonetas en el catálogo.
                    </td>
                </tr>
            `;
            return;
        }

        fleet.forEach(van => {
            const tr = document.createElement('tr');
            const firstImg = (van.images && van.images.length > 0) ? van.images[0] : null;
            const imgHtml = firstImg 
                ? `<img src="${firstImg}" style="width: 36px; height: 26px; object-fit: cover; border-radius: 4px; vertical-align: middle; margin-right: 8px; border: 1px solid rgba(255,255,255,0.15);">` 
                : `<i class="fa-solid fa-truck" style="color: var(--text-muted); margin-right: 8px; font-size: 1rem; vertical-align: middle;"></i>`;

            tr.innerHTML = `
                <td><strong style="color: var(--color-info);">${van.van_type}</strong></td>
                <td><strong>${imgHtml}${van.name}</strong></td>
                <td>${van.plate}</td>
                <td>${van.m3}</td>
                <td class="price-value">${formatCurrency(van.price_sin)}</td>
                <td>${formatCurrency(van.min_price_con)}</td>
                <td>${formatCurrency(van.km_price_con)}/km</td>
                <td>
                    <span class="status-badge ${van.status === 'active' ? 'confirmed' : 'pending'}" style="font-size: 0.7rem; padding: 2px 8px;">
                        ${van.status === 'active' ? 'Activo' : 'Borrador'}
                    </span>
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon edit-van" title="Editar tarifas y datos" data-id="${van.id}">
                            <i class="fa-solid fa-pencil"></i>
                        </button>
                        <button class="btn-icon delete delete-van" title="Eliminar furgoneta" data-id="${van.id}">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            
            // Asignar listeners
            tr.querySelector('.edit-van').addEventListener('click', () => openVanModal(van));
            tr.querySelector('.delete-van').addEventListener('click', () => deleteVan(van.id));
            
            fleetTbody.appendChild(tr);
        });
    };

    // Eliminar furgoneta
    const deleteVan = async (id) => {
        const vanObj = fleet.find(v => v.id === id);
        if (!vanObj) return;

        if (vanObj.van_type === 'medium' || vanObj.van_type === 'large') {
            if (!confirm(`La furgoneta "${vanObj.name}" es parte de la configuración base inicial. ¿Seguro que quieres eliminarla?`)) {
                return;
            }
        } else {
            if (!confirm(`¿Seguro que quieres eliminar la furgoneta "${vanObj.name}" permanentemente del catálogo?`)) {
                return;
            }
        }

        const token = localStorage.getItem('admin_token');
        if (!token) return;

        try {
            const response = await fetch(`/api/vans/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Furgoneta eliminada correctamente.', 'success');
                fetchFleet();
            } else {
                showToast(data.error || 'Error al eliminar furgoneta.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al conectar con el servidor.', 'error');
        }
    };

    // Renderizar la previsualización de imágenes de furgonetas en el modal
    const renderVanImagesPreview = () => {
        vanImagesPreviewGrid.innerHTML = '';
        
        const totalImages = currentVanImages.length + newVanFiles.length;
        if (totalImages === 0) {
            vanImagesPreviewGrid.innerHTML = '<span style="grid-column: 1 / -1; font-size: 0.75rem; color: var(--text-muted); text-align: center; width: 100%; padding: 0.5rem 0;">Sin imágenes (se usará silueta genérica)</span>';
            return;
        }

        // 1. Mostrar imágenes existentes cargadas de la base de datos
        currentVanImages.forEach((imgUrl, index) => {
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.width = '100%';
            container.style.height = '60px';
            container.style.borderRadius = '4px';
            container.style.overflow = 'hidden';
            container.style.border = '1px solid rgba(255,255,255,0.1)';

            const img = document.createElement('img');
            img.src = imgUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '2px';
            deleteBtn.style.right = '2px';
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.85)';
            deleteBtn.style.color = '#fff';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '18px';
            deleteBtn.style.height = '18px';
            deleteBtn.style.display = 'flex';
            deleteBtn.style.alignItems = 'center';
            deleteBtn.style.justifyContent = 'center';
            deleteBtn.style.fontSize = '12px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.padding = '0';
            deleteBtn.style.lineHeight = '1';

            deleteBtn.addEventListener('click', () => {
                currentVanImages.splice(index, 1);
                renderVanImagesPreview();
            });

            container.appendChild(img);
            container.appendChild(deleteBtn);
            vanImagesPreviewGrid.appendChild(container);
        });

        // 2. Mostrar imágenes nuevas seleccionadas pendientes de subir
        newVanFiles.forEach((file, index) => {
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.width = '100%';
            container.style.height = '60px';
            container.style.borderRadius = '4px';
            container.style.overflow = 'hidden';
            container.style.border = '1px dashed var(--color-neon)';

            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '2px';
            deleteBtn.style.right = '2px';
            deleteBtn.style.background = 'rgba(239, 68, 68, 0.85)';
            deleteBtn.style.color = '#fff';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '18px';
            deleteBtn.style.height = '18px';
            deleteBtn.style.display = 'flex';
            deleteBtn.style.alignItems = 'center';
            deleteBtn.style.justifyContent = 'center';
            deleteBtn.style.fontSize = '12px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.padding = '0';
            deleteBtn.style.lineHeight = '1';

            // Etiqueta indicando que es nueva
            const newBadge = document.createElement('span');
            newBadge.textContent = 'NUEVA';
            newBadge.style.position = 'absolute';
            newBadge.style.bottom = '2px';
            newBadge.style.left = '2px';
            newBadge.style.background = 'var(--color-neon)';
            newBadge.style.color = '#000';
            newBadge.style.fontSize = '8px';
            newBadge.style.fontWeight = '700';
            newBadge.style.padding = '1px 3px';
            newBadge.style.borderRadius = '2px';

            deleteBtn.addEventListener('click', () => {
                newVanFiles.splice(index, 1);
                renderVanImagesPreview();
            });

            container.appendChild(img);
            container.appendChild(deleteBtn);
            container.appendChild(newBadge);
            vanImagesPreviewGrid.appendChild(container);
        });
    };

    // Trigger de selección de imágenes
    vanBtnUploadTrigger.addEventListener('click', () => {
        vanFormImagesInput.click();
    });

    // Control del cambio en la selección de archivos
    vanFormImagesInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        newVanFiles = [...newVanFiles, ...files];
        vanFormImagesInput.value = ''; // Resetear para permitir seleccionar los mismos archivos
        renderVanImagesPreview();
    });

    const renderVanExtrasPreview = () => {
        if (!vanExtrasPreviewTbody) return;
        
        if (currentVanExtras.length === 0) {
            vanExtrasPreviewTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1rem; color: var(--text-muted);">
                        No se han añadido extras para este vehículo.
                    </td>
                </tr>
            `;
            return;
        }
        
        vanExtrasPreviewTbody.innerHTML = '';
        currentVanExtras.forEach((extra, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${extra.name}</strong></td>
                <td><strong>${parseFloat(extra.price).toFixed(2)} €</strong></td>
                <td>${extra.type === 'daily' ? 'Por día' : 'Pago único'}</td>
                <td>
                    <button type="button" class="btn-icon delete remove-extra-btn" data-index="${idx}" style="padding: 2px 6px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            
            tr.querySelector('.remove-extra-btn').addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                currentVanExtras.splice(index, 1);
                renderVanExtrasPreview();
            });
            
            vanExtrasPreviewTbody.appendChild(tr);
        });
    };

    // Abrir modal de furgonetas para añadir o editar
    const openVanModal = (van = null) => {
        if (van) {
            vanModalTitle.textContent = 'Editar Furgoneta';
            vanFormId.value = van.id;
            vanFormType.value = van.van_type;
            vanFormType.disabled = true;
            vanFormName.value = van.name;
            vanFormPlate.value = van.plate;
            vanFormM3.value = van.m3;
            vanFormPriceSin.value = van.price_sin;
            vanFormMinPriceCon.value = van.min_price_con;
            vanFormKmPriceCon.value = van.km_price_con;
            vanFormStatus.value = van.status;
            
            // Cargar imágenes
            currentVanImages = Array.isArray(van.images) ? [...van.images] : [];
            newVanFiles = [];
            renderVanImagesPreview();

            // Cargar extras
            currentVanExtras = Array.isArray(van.custom_extras) ? [...van.custom_extras] : [];
            if (currentVanExtras.length === 0) {
                currentVanExtras = [
                    { name: 'GPS Navegador', price: van.extra_gps_price !== undefined ? parseFloat(van.extra_gps_price) : 5.00, type: 'daily' },
                    { name: 'Segundo Conductor', price: van.extra_driver_price !== undefined ? parseFloat(van.extra_driver_price) : 8.00, type: 'daily' },
                    { name: 'Kit Mudanza', price: van.extra_moving_price !== undefined ? parseFloat(van.extra_moving_price) : 10.00, type: 'once' }
                ];
            }
            renderVanExtrasPreview();
        } else {
            vanModalTitle.textContent = 'Añadir Nueva Furgoneta';
            vanFormId.value = '';
            vanFormType.value = '';
            vanFormType.disabled = false;
            vanFormName.value = '';
            vanFormPlate.value = '';
            vanFormM3.value = '';
            vanFormPriceSin.value = '';
            vanFormMinPriceCon.value = '';
            vanFormKmPriceCon.value = '';
            vanFormStatus.value = 'active';
            
            currentVanImages = [];
            newVanFiles = [];
            renderVanImagesPreview();

            currentVanExtras = [
                { name: 'GPS Navegador', price: 5.00, type: 'daily' },
                { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
                { name: 'Kit Mudanza', price: 10.00, type: 'once' }
            ];
            renderVanExtrasPreview();
        }
        vanModal.classList.add('active');
    };

    const closeVanModal = () => {
        vanModal.classList.remove('active');
        vanForm.reset();
        currentVanImages = [];
        newVanFiles = [];
        renderVanImagesPreview();
        currentVanExtras = [];
        renderVanExtrasPreview();
    };

    // Event listeners de la pestaña
    tabBookings.addEventListener('click', () => switchTab('bookings'));
    tabFleet.addEventListener('click', () => switchTab('fleet'));
    tabSettings.addEventListener('click', () => switchTab('settings'));
    btnAddVan.addEventListener('click', () => openVanModal());
    vanModalCloseBtn.addEventListener('click', closeVanModal);
    vanBtnCancel.addEventListener('click', closeVanModal);
    
    // Listener botón Añadir Extra en el formulario furgoneta
    if (btnAddVanExtra) {
        btnAddVanExtra.addEventListener('click', () => {
            const name = vanFormExtraName.value.trim();
            const price = parseFloat(vanFormExtraPrice.value);
            const type = vanFormExtraType.value;
            
            if (!name) {
                showToast('Introduce un nombre para el extra.', 'error');
                vanFormExtraName.focus();
                return;
            }
            if (isNaN(price) || price < 0) {
                showToast('Introduce un precio válido.', 'error');
                vanFormExtraPrice.focus();
                return;
            }
            
            currentVanExtras.push({ name, price, type });
            vanFormExtraName.value = '';
            vanFormExtraPrice.value = '';
            renderVanExtrasPreview();
        });
    }
    
    vanModal.addEventListener('click', (e) => {
        if (e.target === vanModal) closeVanModal();
    });

    // Guardar horarios settings
    settingsHoursForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('admin_token');
        
        try {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hours_weekdays: settingHoursWeekdays.value.trim(),
                    hours_saturdays: settingHoursSaturdays.value.trim(),
                    hours_sundays: settingHoursSundays.value.trim()
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                showToast('Horarios actualizados con éxito.', 'success');
            } else {
                showToast(data.error || 'Error al actualizar horarios.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de conexión con el servidor.', 'error');
        }
    });

    // Envío del formulario de furgoneta
    vanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = vanFormId.value;
        
        const formData = new FormData();
        formData.append('van_type', vanFormType.value.trim());
        formData.append('name', vanFormName.value.trim());
        formData.append('plate', vanFormPlate.value.trim());
        formData.append('m3', vanFormM3.value.trim());
        formData.append('price_sin', parseFloat(vanFormPriceSin.value));
        formData.append('min_price_con', parseFloat(vanFormMinPriceCon.value));
        formData.append('km_price_con', parseFloat(vanFormKmPriceCon.value));
        formData.append('status', vanFormStatus.value);
        formData.append('existing_images', JSON.stringify(currentVanImages));
        formData.append('custom_extras', JSON.stringify(currentVanExtras));
        
        newVanFiles.forEach(file => {
            formData.append('images', file);
        });

        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const url = id ? `/api/vans/${id}` : '/api/vans';
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Authorization': `Bearer ${token}` 
                },
                body: formData
            });
            const data = await response.json();
            
            if (response.ok) {
                showToast(id ? 'Furgoneta actualizada con éxito.' : 'Nueva furgoneta registrada con éxito.', 'success');
                closeVanModal();
                fetchFleet();
            } else {
                showToast(data.error || 'Error al guardar los cambios.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al guardar furgoneta.', 'error');
        }
    });
    
    // Inicializar página
    checkAuth();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
