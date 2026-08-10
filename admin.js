document.addEventListener('DOMContentLoaded', () => {
    
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
    const vanFormStatus = document.getElementById('van-form-status');
    const vanBtnCancel = document.getElementById('van-btn-cancel');
    const vanModalTitle = document.getElementById('van-modal-title');
    
    // Variables de Estado de Flota
    let fleet = [];

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
        if (tab === 'bookings') {
            tabBookings.classList.add('btn-primary');
            tabBookings.style.borderColor = 'var(--color-neon)';
            tabFleet.classList.remove('btn-primary');
            tabFleet.style.borderColor = 'rgba(255,255,255,0.08)';
            
            sectionBookings.style.display = 'block';
            sectionFleet.style.display = 'none';
        } else {
            tabFleet.classList.add('btn-primary');
            tabFleet.style.borderColor = 'var(--color-neon)';
            tabBookings.classList.remove('btn-primary');
            tabBookings.style.borderColor = 'rgba(255,255,255,0.08)';
            
            sectionBookings.style.display = 'none';
            sectionFleet.style.display = 'block';
            fetchFleet();
        }
    };

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
            tr.innerHTML = `
                <td><strong style="color: var(--color-info);">${van.van_type}</strong></td>
                <td><strong>${van.name}</strong></td>
                <td>${van.plate}</td>
                <td>${van.m3}</td>
                <td class="price-value">${formatCurrency(van.price_sin)}</td>
                <td>${formatCurrency(van.min_price_con)}</td>
                <td>${formatCurrency(van.km_price_con)}/km</td>
                <td>
                    <span class="status-badge ${van.status === 'active' ? 'confirmed' : 'cancelled'}" style="font-size: 0.7rem; padding: 2px 8px;">
                        ${van.status === 'active' ? 'Activo' : 'Inactivo'}
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
        }
        vanModal.classList.add('active');
    };

    const closeVanModal = () => {
        vanModal.classList.remove('active');
        vanForm.reset();
    };

    // Event listeners de la pestaña
    tabBookings.addEventListener('click', () => switchTab('bookings'));
    tabFleet.addEventListener('click', () => switchTab('fleet'));
    btnAddVan.addEventListener('click', () => openVanModal());
    vanModalCloseBtn.addEventListener('click', closeVanModal);
    vanBtnCancel.addEventListener('click', closeVanModal);
    
    vanModal.addEventListener('click', (e) => {
        if (e.target === vanModal) closeVanModal();
    });

    // Envío del formulario de furgoneta
    vanForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = vanFormId.value;
        const bodyData = {
            van_type: vanFormType.value.trim(),
            name: vanFormName.value.trim(),
            plate: vanFormPlate.value.trim(),
            m3: vanFormM3.value.trim(),
            price_sin: parseFloat(vanFormPriceSin.value),
            min_price_con: parseFloat(vanFormMinPriceCon.value),
            km_price_con: parseFloat(vanFormKmPriceCon.value),
            status: vanFormStatus.value
        };

        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const url = id ? `/api/vans/${id}` : '/api/vans';
        const method = id ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(bodyData)
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
});
