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

    // Elementos del formulario de contrato colapsable
    const btnToggleContractForm = document.getElementById('btn-toggle-contract-form');
    const contractFormContainer = document.getElementById('contract-form-container');
    const contractFormChevron = document.getElementById('contract-form-chevron');
    const btnSaveContractData = document.getElementById('btn-save-contract-data');
    
    // Inputs del contrato
    const contractAppliedRate = document.getElementById('contract-applied-rate');
    const contractClientBirthdate = document.getElementById('contract-client-birthdate');
    const contractClientAddress = document.getElementById('contract-client-address');
    const contractClientPostalCode = document.getElementById('contract-client-postal-code');
    const contractClientCity = document.getElementById('contract-client-city');
    const contractClientProvince = document.getElementById('contract-client-province');
    const contractClientLicenseNum = document.getElementById('contract-client-license-num');
    const contractClientLicenseExp = document.getElementById('contract-client-license-exp');
    const contractSecondDriverName = document.getElementById('contract-second-driver-name');
    const contractSecondDriverDni = document.getElementById('contract-second-driver-dni');
    const contractSecondDriverPhone = document.getElementById('contract-second-driver-phone');
    const contractSecondDriverLicenseNum = document.getElementById('contract-second-driver-license-num');
    const contractSecondDriverLicenseExp = document.getElementById('contract-second-driver-license-exp');
    const contractKmOut = document.getElementById('contract-km-out');
    const contractKmIn = document.getElementById('contract-km-in');
    const contractKmIncluded = document.getElementById('contract-km-included');
    const contractKmPriceExtra = document.getElementById('contract-km-price-extra');
    const contractKmExtraPackage = document.getElementById('contract-km-extra-package');
    const contractFuelOut = document.getElementById('contract-fuel-out');
    const contractFuelIn = document.getElementById('contract-fuel-in');
    const contractAdblueOut = document.getElementById('contract-adblue-out');
    const contractAdblueIn = document.getElementById('contract-adblue-in');
    const contractPaymentMethod = document.getElementById('contract-payment-method');
    const contractCleaningPrice = document.getElementById('contract-cleaning-price');
    const contractFianzaReturnedFull = document.getElementById('contract-fianza-returned-full');
    const contractFianzaReturnedPartial = document.getElementById('contract-fianza-returned-partial');
    const contractFianzaRetainedAmount = document.getElementById('contract-fianza-retained-amount');
    const contractFianzaRetainedReason = document.getElementById('contract-fianza-retained-reason');
    const contractCleanInteriorYes = document.getElementById('contract-clean-interior-yes');
    const contractCleanInteriorNo = document.getElementById('contract-clean-interior-no');
    const contractCleanExteriorYes = document.getElementById('contract-clean-exterior-yes');
    const contractCleanExteriorNo = document.getElementById('contract-clean-exterior-no');
    const contractAccessoryPermiso = document.getElementById('contract-accessory-permiso');
    const contractAccessoryFicha = document.getElementById('contract-accessory-ficha');
    const contractAccessoryLlave = document.getElementById('contract-accessory-llave');
    const contractAccessoryLlaveRepuesto = document.getElementById('contract-accessory-llave-repuesto');
    const contractAccessoryV16 = document.getElementById('contract-accessory-v16');
    const contractAccessoryAdaptador = document.getElementById('contract-accessory-adaptador');
    const contractAccessoryGancho = document.getElementById('contract-accessory-gancho');
    const contractAccessoryChaleco = document.getElementById('contract-accessory-chaleco');
    const contractAccessoryRueda = document.getElementById('contract-accessory-rueda');
    const contractAccessoryGato = document.getElementById('contract-accessory-gato');
    const contractAccessoryManual = document.getElementById('contract-accessory-manual');
    const contractAccessoryOthers = document.getElementById('contract-accessory-others');

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
    const vanFormOccupants = document.getElementById('van-form-occupants');
    const vanFormEcoLabel = document.getElementById('van-form-eco-label');
    const vanFormFuelType = document.getElementById('van-form-fuel-type');
    const vanFormKmLimit = document.getElementById('van-form-km-limit');
    const vanFormMaxMass = document.getElementById('van-form-max-mass');
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
    const settingShowReviewsCount = document.getElementById('setting-show-reviews-count');
    
    // Elementos de la Pestaña de Disponibilidad
    const tabAvailability = document.getElementById('tab-availability');
    const sectionAvailability = document.getElementById('section-availability');
    const blockageForm = document.getElementById('availability-blockage-form');
    const blockVanType = document.getElementById('block-van-type');
    const blockStartDate = document.getElementById('block-start-date');
    const blockEndDate = document.getElementById('block-end-date');
    const blockReason = document.getElementById('block-reason');
    const adminBlockagesTbody = document.getElementById('admin-blockages-tbody');

    // Elementos de la Pestaña de FAQs
    const tabFaqs = document.getElementById('tab-faqs');
    const sectionFaqs = document.getElementById('section-faqs');
    const btnAddFaq = document.getElementById('btn-add-faq');
    const adminFaqsTbody = document.getElementById('admin-faqs-tbody');

    // Modal de FAQs
    const faqModal = document.getElementById('faq-modal');
    const faqModalCloseBtn = document.getElementById('faq-modal-close-btn');
    const faqForm = document.getElementById('faq-form');
    const faqFormId = document.getElementById('faq-form-id');
    const faqFormQuestion = document.getElementById('faq-form-question');
    const faqFormAnswer = document.getElementById('faq-form-answer');
    const faqFormOrder = document.getElementById('faq-form-order');
    const faqBtnCancel = document.getElementById('faq-btn-cancel');
    const faqModalTitle = document.getElementById('faq-modal-title');

    // Elementos de Reseñas / Códigos
    const btnGenerateCode = document.getElementById('btn-generate-code');
    const generatedCodeBox = document.getElementById('generated-code-box');
    const generatedCodeText = document.getElementById('generated-code-text');
    const adminReviewsTbody = document.getElementById('admin-reviews-tbody');
    
    // Variables de Estado de Flota
    let fleet = [];
    let currentFormPhotos = [];
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
    const updateBookingInApi = async (id, fields, customToastMsg = null) => {
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
            
            showToast(customToastMsg || `Reserva #${id} actualizada con éxito.`, 'success');
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
                        ${booking.status === 'pending' ? 'Pendiente' : booking.status === 'paid_pending' ? 'Pendiente Aprobación (Pagada)' : booking.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
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
        modalStatusBadge.textContent = booking.status === 'pending' ? 'Pendiente' : booking.status === 'paid_pending' ? 'Pendiente Aprobación (Pagada)' : booking.status === 'confirmed' ? 'Confirmado' : 'Cancelado';
        
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

        // Resetear colapsable contrato
        contractFormContainer.style.display = 'none';
        contractFormChevron.className = 'fa-solid fa-chevron-down';

        // Rellenar formulario contrato
        contractAppliedRate.value = booking.contract_applied_rate || '';
        contractClientBirthdate.value = booking.client_birthdate ? booking.client_birthdate.split('T')[0] : '';
        contractClientAddress.value = booking.client_address || '';
        contractClientPostalCode.value = booking.client_postal_code || '';
        contractClientCity.value = booking.client_city || '';
        contractClientProvince.value = booking.client_province || '';
        contractClientLicenseNum.value = booking.client_license_num || '';
        contractClientLicenseExp.value = booking.client_license_exp ? booking.client_license_exp.split('T')[0] : '';
        
        contractSecondDriverName.value = booking.second_driver_name || '';
        contractSecondDriverDni.value = booking.second_driver_dni || '';
        contractSecondDriverPhone.value = booking.second_driver_phone || '';
        contractSecondDriverLicenseNum.value = booking.second_driver_license_num || '';
        contractSecondDriverLicenseExp.value = booking.second_driver_license_exp ? booking.second_driver_license_exp.split('T')[0] : '';
        
        contractKmOut.value = booking.km_out !== undefined && booking.km_out !== null ? booking.km_out : 0;
        contractKmIn.value = booking.km_in !== undefined && booking.km_in !== null ? booking.km_in : 0;
        contractKmIncluded.value = booking.km_included !== undefined && booking.km_included !== null ? booking.km_included : 350;
        contractKmPriceExtra.value = booking.km_price_extra !== undefined && booking.km_price_extra !== null ? booking.km_price_extra : 0.28;
        contractKmExtraPackage.checked = !!booking.km_extra_package;
        
        contractFuelOut.value = booking.fuel_out || 'Lleno';
        contractFuelIn.value = booking.fuel_in || 'Lleno';
        contractAdblueOut.value = booking.adblue_out || 'Lleno';
        contractAdblueIn.value = booking.adblue_in || 'Lleno';
        
        contractPaymentMethod.value = booking.payment_method || 'tarjeta';
        contractCleaningPrice.value = booking.cleaning_price !== undefined && booking.cleaning_price !== null ? booking.cleaning_price : 0.00;
        contractFianzaReturnedFull.checked = !!booking.fianza_returned_full;
        contractFianzaReturnedPartial.checked = !!booking.fianza_returned_partial;
        contractFianzaRetainedAmount.value = booking.fianza_retained_amount !== undefined && booking.fianza_retained_amount !== null ? booking.fianza_retained_amount : 0.00;
        contractFianzaRetainedReason.value = booking.fianza_retained_reason || '';
        
        contractCleanInteriorYes.checked = !!booking.clean_interior_yes;
        contractCleanInteriorNo.checked = !!booking.clean_interior_no;
        contractCleanExteriorYes.checked = !!booking.clean_exterior_yes;
        contractCleanExteriorNo.checked = !!booking.clean_exterior_no;
        
        contractAccessoryPermiso.checked = !!booking.accessory_permiso;
        contractAccessoryFicha.checked = !!booking.accessory_ficha;
        contractAccessoryLlave.checked = !!booking.accessory_llave;
        contractAccessoryLlaveRepuesto.checked = !!booking.accessory_llave_repuesto;
        contractAccessoryV16.checked = !!booking.accessory_v16;
        contractAccessoryAdaptador.checked = !!booking.accessory_adaptador;
        contractAccessoryGancho.checked = !!booking.accessory_gancho;
        contractAccessoryChaleco.checked = !!booking.accessory_chaleco;
        contractAccessoryRueda.checked = !!booking.accessory_rueda;
        contractAccessoryGato.checked = !!booking.accessory_gato;
        contractAccessoryManual.checked = !!booking.accessory_manual;
        contractAccessoryOthers.value = booking.accessory_others || '';
        
        // Inyectar botones dinámicos en el footer
        const phone = booking.client_phone || '34614767411';
        modalActionsFooter.innerHTML = `
            <a href="https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(`Hola ${booking.client_name || booking.name}, te escribo de RentMeUskar acerca de tu reserva #${booking.id}...`)}" target="_blank" class="btn" style="background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25d366;">
                <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </a>
            
            ${booking.status === 'paid_pending' ? `
                <button class="btn btn-primary" id="modal-btn-approve-paid" style="background: var(--color-neon); border-color: var(--color-neon); color: #000;">
                    <i class="fa-solid fa-circle-check"></i> Aprobar Reserva
                </button>
                <button class="btn" style="border-color: var(--color-danger); color: var(--color-danger); background: rgba(255, 77, 109, 0.05);" id="modal-btn-refund-cancel">
                    <i class="fa-solid fa-rotate-left"></i> Cancelar y Reembolsar
                </button>
            ` : `
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
            `}
            <button class="btn" style="border-color: var(--color-danger); color: var(--color-danger);" id="modal-btn-delete">
                <i class="fa-solid fa-trash-can"></i> Eliminar
            </button>
        `;
        
        // Listeners footer modal
        const btnAppPaid = document.getElementById('modal-btn-approve-paid');
        const btnRefCanc = document.getElementById('modal-btn-refund-cancel');
        const btnConf = document.getElementById('modal-btn-confirm');
        const btnRefund = document.getElementById('modal-btn-refund-fianza');
        const btnPay = document.getElementById('modal-btn-pay');
        const btnCanc = document.getElementById('modal-btn-cancel');
        const btnDel = document.getElementById('modal-btn-delete');
        
        if (btnAppPaid) btnAppPaid.addEventListener('click', () => updateBookingInApi(booking.id, { status: 'confirmed' }));
        if (btnRefCanc) btnRefCanc.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que deseas cancelar la reserva y realizar el reembolso total al cliente?')) {
                updateBookingInApi(booking.id, { 
                    status: 'cancelled',
                    payment_status: 'refunded',
                    fianza_status: 'refunded'
                }, 'Reserva cancelada y pago online de furgoneta reembolsado con éxito.');
            }
        });
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

    // Toggle colapsable formulario contrato
    btnToggleContractForm.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = contractFormContainer.style.display === 'none';
        contractFormContainer.style.display = isHidden ? 'block' : 'none';
        contractFormChevron.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    });

    // Guardar cambios del contrato
    btnSaveContractData.addEventListener('click', async () => {
        if (!selectedBooking) return;
        
        const fields = {
            contract_applied_rate: contractAppliedRate.value.trim(),
            client_birthdate: contractClientBirthdate.value ? contractClientBirthdate.value : null,
            client_address: contractClientAddress.value.trim(),
            client_postal_code: contractClientPostalCode.value.trim(),
            client_city: contractClientCity.value.trim(),
            client_province: contractClientProvince.value.trim(),
            client_license_num: contractClientLicenseNum.value.trim(),
            client_license_exp: contractClientLicenseExp.value ? contractClientLicenseExp.value : null,
            
            second_driver_name: contractSecondDriverName.value.trim(),
            second_driver_dni: contractSecondDriverDni.value.trim(),
            second_driver_phone: contractSecondDriverPhone.value.trim(),
            second_driver_license_num: contractSecondDriverLicenseNum.value.trim(),
            second_driver_license_exp: contractSecondDriverLicenseExp.value ? contractSecondDriverLicenseExp.value : null,
            
            km_out: parseInt(contractKmOut.value) || 0,
            km_in: parseInt(contractKmIn.value) || 0,
            km_included: parseInt(contractKmIncluded.value) || 350,
            km_price_extra: parseFloat(contractKmPriceExtra.value) || 0.28,
            km_extra_package: contractKmExtraPackage.checked,
            
            fuel_out: contractFuelOut.value,
            fuel_in: contractFuelIn.value,
            adblue_out: contractAdblueOut.value,
            adblue_in: contractAdblueIn.value,
            
            payment_method: contractPaymentMethod.value,
            cleaning_price: parseFloat(contractCleaningPrice.value) || 0.00,
            fianza_returned_full: contractFianzaReturnedFull.checked,
            fianza_returned_partial: contractFianzaReturnedPartial.checked,
            fianza_retained_amount: parseFloat(contractFianzaRetainedAmount.value) || 0.00,
            fianza_retained_reason: contractFianzaRetainedReason.value.trim(),
            
            clean_interior_yes: contractCleanInteriorYes.checked,
            clean_interior_no: contractCleanInteriorNo.checked,
            clean_exterior_yes: contractCleanExteriorYes.checked,
            clean_exterior_no: contractCleanExteriorNo.checked,
            
            accessory_permiso: contractAccessoryPermiso.checked,
            accessory_ficha: contractAccessoryFicha.checked,
            accessory_llave: contractAccessoryLlave.checked,
            accessory_llave_repuesto: contractAccessoryLlaveRepuesto.checked,
            accessory_v16: contractAccessoryV16.checked,
            accessory_adaptador: contractAccessoryAdaptador.checked,
            accessory_gancho: contractAccessoryGancho.checked,
            accessory_chaleco: contractAccessoryChaleco.checked,
            accessory_rueda: contractAccessoryRueda.checked,
            accessory_gato: contractAccessoryGato.checked,
            accessory_manual: contractAccessoryManual.checked,
            accessory_others: contractAccessoryOthers.value.trim()
        };
        
        await updateBookingInApi(selectedBooking.id, fields);
    });

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
        tabAvailability.classList.remove('btn-primary');
        tabAvailability.style.borderColor = 'rgba(255,255,255,0.08)';
        tabFaqs.classList.remove('btn-primary');
        tabFaqs.style.borderColor = 'rgba(255,255,255,0.08)';
        tabSettings.classList.remove('btn-primary');
        tabSettings.style.borderColor = 'rgba(255,255,255,0.08)';
        
        sectionBookings.style.display = 'none';
        sectionFleet.style.display = 'none';
        sectionAvailability.style.display = 'none';
        sectionFaqs.style.display = 'none';
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
        } else if (tab === 'availability') {
            tabAvailability.classList.add('btn-primary');
            tabAvailability.style.borderColor = 'var(--color-neon)';
            sectionAvailability.style.display = 'block';
            fetchBlockages();
            populateBlockVanSelect();
        } else if (tab === 'faqs') {
            tabFaqs.classList.add('btn-primary');
            tabFaqs.style.borderColor = 'var(--color-neon)';
            sectionFaqs.style.display = 'block';
            fetchFaqs();
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
            if (settingShowReviewsCount) {
                settingShowReviewsCount.checked = data.show_reviews_count === 'true';
            }
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

    // Renderizar la previsualización de imágenes de furgonetas en el modal con soporte de ordenación
    const renderVanImagesPreview = () => {
        vanImagesPreviewGrid.innerHTML = '';
        
        if (currentFormPhotos.length === 0) {
            vanImagesPreviewGrid.innerHTML = '<span style="grid-column: 1 / -1; font-size: 0.75rem; color: var(--text-muted); text-align: center; width: 100%; padding: 0.5rem 0;">Sin imágenes (se usará silueta genérica)</span>';
            return;
        }

        currentFormPhotos.forEach((photo, index) => {
            const card = document.createElement('div');
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.width = '100px';
            card.style.gap = '4px';
            card.style.background = 'rgba(255, 255, 255, 0.03)';
            card.style.borderRadius = '8px';
            card.style.padding = '4px';
            card.style.border = index === 0 ? '2px solid var(--color-neon)' : '1px solid rgba(255, 255, 255, 0.1)';

            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.style.width = '100%';
            imgContainer.style.height = '65px';
            imgContainer.style.borderRadius = '6px';
            imgContainer.style.overflow = 'hidden';

            const img = document.createElement('img');
            img.src = photo.type === 'server' ? photo.url : photo.previewUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            imgContainer.appendChild(img);

            // Badge de Portada
            if (index === 0) {
                const coverBadge = document.createElement('span');
                coverBadge.textContent = 'PORTADA';
                coverBadge.style.position = 'absolute';
                coverBadge.style.top = '3px';
                coverBadge.style.left = '3px';
                coverBadge.style.background = 'var(--color-neon)';
                coverBadge.style.color = '#000';
                coverBadge.style.fontSize = '7px';
                coverBadge.style.fontWeight = '900';
                coverBadge.style.padding = '1px 3px';
                coverBadge.style.borderRadius = '2px';
                coverBadge.style.zIndex = '2';
                imgContainer.appendChild(coverBadge);
            } else if (photo.type === 'file') {
                const newBadge = document.createElement('span');
                newBadge.textContent = 'NUEVA';
                newBadge.style.position = 'absolute';
                newBadge.style.bottom = '3px';
                newBadge.style.left = '3px';
                newBadge.style.background = 'rgba(255, 255, 255, 0.15)';
                newBadge.style.color = '#fff';
                newBadge.style.fontSize = '7px';
                newBadge.style.fontWeight = '700';
                newBadge.style.padding = '1px 3px';
                newBadge.style.borderRadius = '2px';
                newBadge.style.zIndex = '2';
                imgContainer.appendChild(newBadge);
            }

            card.appendChild(imgContainer);

            // Botones de Ordenación y Borrado siempre visibles
            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.justifyContent = 'space-between';
            btnRow.style.gap = '2px';
            btnRow.style.marginTop = '2px';

            // Flecha Izquierda
            const leftBtn = document.createElement('button');
            leftBtn.type = 'button';
            leftBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
            leftBtn.style.background = 'rgba(255,255,255,0.05)';
            leftBtn.style.border = 'none';
            leftBtn.style.color = '#fff';
            leftBtn.style.flex = '1';
            leftBtn.style.height = '20px';
            leftBtn.style.borderRadius = '4px';
            leftBtn.style.cursor = index === 0 ? 'not-allowed' : 'pointer';
            leftBtn.style.opacity = index === 0 ? '0.2' : '0.8';
            leftBtn.style.padding = '0';
            leftBtn.style.fontSize = '0.75rem';
            if (index > 0) {
                leftBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const temp = currentFormPhotos[index];
                    currentFormPhotos[index] = currentFormPhotos[index - 1];
                    currentFormPhotos[index - 1] = temp;
                    renderVanImagesPreview();
                });
            }
            btnRow.appendChild(leftBtn);

            // Borrar
            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.style.background = 'rgba(239, 68, 68, 0.2)';
            delBtn.style.border = 'none';
            delBtn.style.color = '#ef4444';
            delBtn.style.flex = '1';
            delBtn.style.height = '20px';
            delBtn.style.borderRadius = '4px';
            delBtn.style.cursor = 'pointer';
            delBtn.style.padding = '0';
            delBtn.style.fontSize = '0.75rem';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentFormPhotos.splice(index, 1);
                renderVanImagesPreview();
            });
            btnRow.appendChild(delBtn);

            // Flecha Derecha
            const rightBtn = document.createElement('button');
            rightBtn.type = 'button';
            rightBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            rightBtn.style.background = 'rgba(255,255,255,0.05)';
            rightBtn.style.border = 'none';
            rightBtn.style.color = '#fff';
            rightBtn.style.flex = '1';
            rightBtn.style.height = '20px';
            rightBtn.style.borderRadius = '4px';
            rightBtn.style.cursor = index === currentFormPhotos.length - 1 ? 'not-allowed' : 'pointer';
            rightBtn.style.opacity = index === currentFormPhotos.length - 1 ? '0.2' : '0.8';
            rightBtn.style.padding = '0';
            rightBtn.style.fontSize = '0.75rem';
            if (index < currentFormPhotos.length - 1) {
                rightBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const temp = currentFormPhotos[index];
                    currentFormPhotos[index] = currentFormPhotos[index + 1];
                    currentFormPhotos[index + 1] = temp;
                    renderVanImagesPreview();
                });
            }
            btnRow.appendChild(rightBtn);

            card.appendChild(btnRow);
            vanImagesPreviewGrid.appendChild(card);
        });
    };

    // Trigger de selección de imágenes
    vanBtnUploadTrigger.addEventListener('click', () => {
        vanFormImagesInput.click();
    });

    // Control del cambio en la selección de archivos
    vanFormImagesInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            currentFormPhotos.push({
                type: 'file',
                file: file,
                previewUrl: URL.createObjectURL(file)
            });
        });
        vanFormImagesInput.value = ''; // Resetear
        renderVanImagesPreview();
    });

    const renderVanExtrasPreview = () => {
        if (!vanExtrasPreviewTbody) return;
        
        if (currentVanExtras.length === 0) {
            vanExtrasPreviewTbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.85rem;">
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
                <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color:#fff;"><strong>${extra.name}</strong></td>
                <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color:var(--color-neon);"><strong>${parseFloat(extra.price).toFixed(2)} €</strong></td>
                <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); color:var(--text-secondary);">${extra.type === 'daily' ? 'Por día' : 'Pago único'}</td>
                <td style="padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center;">
                    <button type="button" class="btn-icon delete remove-extra-btn" data-index="${idx}" style="padding: 4px 8px; font-size: 0.8rem; background: var(--color-danger); border: none; border-radius: 4px; color: #fff; cursor: pointer;">
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
            vanFormM3.value = van.m3 ? van.m3.replace(/[^0-9]/g, '') : '';
            vanFormPriceSin.value = van.price_sin;
            vanFormMinPriceCon.value = van.min_price_con;
            vanFormKmPriceCon.value = van.km_price_con;
            vanFormStatus.value = van.status;
            vanFormOccupants.value = van.max_occupants !== undefined ? van.max_occupants : 3;
            vanFormEcoLabel.value = van.eco_label || 'C';
            vanFormFuelType.value = van.fuel_type || 'GASOIL';
            vanFormKmLimit.value = van.daily_km_limit !== undefined ? van.daily_km_limit : 350;
            vanFormMaxMass.value = van.max_mass !== undefined ? van.max_mass : 2800;
            
            // Cargar imágenes
            currentFormPhotos = Array.isArray(van.images) ? van.images.map(img => ({ type: 'server', url: img })) : [];
            renderVanImagesPreview();

            // Cargar extras
            currentVanExtras = Array.isArray(van.custom_extras) ? [...van.custom_extras] : [];
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
            vanFormOccupants.value = 3;
            vanFormEcoLabel.value = 'C';
            vanFormFuelType.value = 'GASOIL';
            vanFormKmLimit.value = 350;
            vanFormMaxMass.value = 2800;
            
            currentFormPhotos = [];
            renderVanImagesPreview();

            currentVanExtras = [];
            renderVanExtrasPreview();
        }
        vanModal.classList.add('active');
    };

    const closeVanModal = () => {
        vanModal.classList.remove('active');
        vanForm.reset();
        currentFormPhotos = [];
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
                    hours_sundays: settingHoursSundays.value.trim(),
                    show_reviews_count: settingShowReviewsCount.checked ? 'true' : 'false'
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
        let m3Val = vanFormM3.value.trim();
        if (m3Val && !m3Val.endsWith('m³')) {
            m3Val += 'm³';
        }
        formData.append('m3', m3Val);
        formData.append('price_sin', parseFloat(vanFormPriceSin.value));
        formData.append('min_price_con', parseFloat(vanFormMinPriceCon.value));
        formData.append('km_price_con', parseFloat(vanFormKmPriceCon.value));
        formData.append('status', vanFormStatus.value);
        formData.append('max_occupants', parseInt(vanFormOccupants.value) || 3);
        formData.append('eco_label', vanFormEcoLabel.value.trim() || 'C');
        formData.append('fuel_type', vanFormFuelType.value);
        formData.append('daily_km_limit', parseInt(vanFormKmLimit.value) || 350);
        formData.append('max_mass', parseInt(vanFormMaxMass.value) || 2800);
        
        // Mapear fotos con su orden
        const imageOrder = [];
        const filesToUpload = [];
        currentFormPhotos.forEach(photo => {
            if (photo.type === 'server') {
                imageOrder.push(`server:${photo.url}`);
            } else if (photo.type === 'file') {
                imageOrder.push(`file:${filesToUpload.length}`);
                filesToUpload.push(photo.file);
            }
        });
        
        formData.append('image_order', JSON.stringify(imageOrder));
        filesToUpload.forEach(file => {
            formData.append('images', file);
        });

        formData.append('custom_extras', JSON.stringify(currentVanExtras));

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

    /* ==========================================================================
       9. GESTIÓN DE DISPONIBILIDAD Y BLOQUEOS
       ========================================================================== */

    // Rellenar selector de furgonetas en el formulario de bloqueo
    const populateBlockVanSelect = () => {
        if (!blockVanType) return;
        blockVanType.innerHTML = '<option value="" disabled selected>-- Selecciona un vehículo --</option>';
        fleet.forEach(van => {
            const opt = document.createElement('option');
            opt.value = van.van_type;
            opt.textContent = `${van.name} (${van.plate})`;
            blockVanType.appendChild(opt);
        });
    };

    // Obtener y listar bloqueos activos
    const fetchBlockages = async () => {
        if (!adminBlockagesTbody) return;
        
        adminBlockagesTbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Cargando bloqueos...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('/api/blockages');
            if (res.ok) {
                const blockages = await res.json();
                if (blockages.length === 0) {
                    adminBlockagesTbody.innerHTML = `
                        <tr>
                            <td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                No hay bloqueos activos de disponibilidad.
                            </td>
                        </tr>
                    `;
                } else {
                    adminBlockagesTbody.innerHTML = '';
                    blockages.forEach(block => {
                        const tr = document.createElement('tr');
                        // Buscar el nombre del vehículo
                        const van = fleet.find(v => v.van_type === block.van_type);
                        const vanName = van ? van.name : block.van_type;
                        
                        tr.innerHTML = `
                            <td><strong>${vanName}</strong></td>
                            <td>${block.start_date}</td>
                            <td>${block.end_date}</td>
                            <td><span class="status-badge" style="background: rgba(255,193,7,0.1); color: #ffc107; border: 1px solid rgba(255,193,7,0.2); font-size: 0.75rem; padding: 2px 8px; border-radius: 4px;">${block.reason}</span></td>
                            <td style="text-align: center;">
                                <button class="btn btn-secondary btn-sm btn-delete-blockage" data-id="${block.id}" style="color: var(--color-neon); border-color: rgba(130, 209, 5, 0.2); background: rgba(130, 209, 5, 0.05); padding: 4px 8px;">
                                    <i class="fa-solid fa-trash-can"></i> Eliminar
                                </button>
                            </td>
                        `;
                        adminBlockagesTbody.appendChild(tr);
                    });

                    // Añadir listeners para borrar bloqueos
                    document.querySelectorAll('.btn-delete-blockage').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.currentTarget.getAttribute('data-id');
                            if (confirm('¿Estás seguro de que deseas eliminar este bloqueo de disponibilidad? La furgoneta volverá a estar disponible para esas fechas.')) {
                                await deleteBlockage(id);
                            }
                        });
                    });
                }
            }
        } catch (err) {
            console.error('Error al obtener bloqueos:', err);
            showToast('Error al conectar con la API de disponibilidad.', 'error');
        }
    };

    // Crear bloqueo de disponibilidad
    blockageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const body = {
            van_type: blockVanType.value,
            start_date: blockStartDate.value,
            end_date: blockEndDate.value,
            reason: blockReason.value
        };

        try {
            const res = await fetch('/api/blockages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Bloqueo de disponibilidad registrado con éxito.', 'success');
                blockageForm.reset();
                fetchBlockages();
            } else {
                showToast(data.error || 'Error al guardar el bloqueo.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al registrar el bloqueo.', 'error');
        }
    });

    // Eliminar bloqueo de disponibilidad
    const deleteBlockage = async (id) => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        try {
            const res = await fetch(`/api/blockages/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                showToast('Bloqueo eliminado correctamente.', 'success');
                fetchBlockages();
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al eliminar el bloqueo.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al eliminar el bloqueo.', 'error');
        }
    };

    /* ==========================================================================
       10. GESTIÓN DE PREGUNTAS FRECUENTES (FAQS)
       ========================================================================== */

    // Obtener y listar FAQs
    const fetchFaqs = async () => {
        if (!adminFaqsTbody) return;

        adminFaqsTbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Cargando preguntas frecuentes...
                </td>
            </tr>
        `;

        try {
            const res = await fetch('/api/faqs');
            if (res.ok) {
                const faqs = await res.json();
                if (faqs.length === 0) {
                    adminFaqsTbody.innerHTML = `
                        <tr>
                            <td colspan="4" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                                No hay preguntas frecuentes registradas.
                            </td>
                        </tr>
                    `;
                } else {
                    adminFaqsTbody.innerHTML = '';
                    faqs.forEach(faq => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td style="text-align: center; font-weight: 700; color: var(--color-neon);">${faq.display_order}</td>
                            <td><strong>${faq.question}</strong></td>
                            <td style="color: var(--text-secondary); max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${faq.answer}</td>
                            <td style="text-align: center; display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                                <button class="btn btn-secondary btn-sm btn-edit-faq" data-id="${faq.id}" style="padding: 4px 8px; border-color: rgba(255,255,255,0.1);">
                                    <i class="fa-solid fa-pen-to-square"></i> Editar
                                </button>
                                <button class="btn btn-secondary btn-sm btn-delete-faq" data-id="${faq.id}" style="color: #ff3838; border-color: rgba(255,56,56,0.2); background: rgba(255,56,56,0.05); padding: 4px 8px;">
                                    <i class="fa-solid fa-trash-can"></i> Borrar
                                </button>
                            </td>
                        `;
                        adminFaqsTbody.appendChild(tr);
                    });

                    // Listeners de edición
                    document.querySelectorAll('.btn-edit-faq').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const id = e.currentTarget.getAttribute('data-id');
                            const faq = faqs.find(f => f.id == id);
                            if (faq) openFaqModal(faq);
                        });
                    });

                    // Listeners de borrado
                    document.querySelectorAll('.btn-delete-faq').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const id = e.currentTarget.getAttribute('data-id');
                            if (confirm('¿Estás seguro de que deseas eliminar esta pregunta frecuente?')) {
                                await deleteFaq(id);
                            }
                        });
                    });
                }
            }
        } catch (err) {
            console.error('Error al obtener FAQs:', err);
            showToast('Error al conectar con la API de FAQs.', 'error');
        }
    };

    // Abrir modal FAQ
    const openFaqModal = (faq = null) => {
        if (!faqModal) return;
        
        faqModal.style.display = 'flex';
        if (faq) {
            faqModalTitle.textContent = 'Editar Pregunta Frecuente';
            faqFormId.value = faq.id;
            faqFormQuestion.value = faq.question;
            faqFormAnswer.value = faq.answer;
            faqFormOrder.value = faq.display_order;
        } else {
            faqModalTitle.textContent = 'Añadir Pregunta Frecuente';
            faqFormId.value = '';
            faqFormQuestion.value = '';
            faqFormAnswer.value = '';
            faqFormOrder.value = '0';
        }
    };

    // Cerrar modal FAQ
    const closeFaqModal = () => {
        if (faqModal) faqModal.style.display = 'none';
    };

    // Cerrar modal al hacer clic en cruz o cancelar
    if (faqModalCloseBtn) faqModalCloseBtn.addEventListener('click', closeFaqModal);
    if (faqBtnCancel) faqBtnCancel.addEventListener('click', closeFaqModal);
    
    faqModal.addEventListener('click', (e) => {
        if (e.target === faqModal) closeFaqModal();
    });

    // Guardar / Editar FAQ Form Submit
    faqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        const id = faqFormId.value;
        const body = {
            question: faqFormQuestion.value.trim(),
            answer: faqFormAnswer.value.trim(),
            display_order: parseInt(faqFormOrder.value) || 0
        };

        const url = id ? `/api/faqs/${id}` : '/api/faqs';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                showToast(id ? 'FAQ actualizada con éxito.' : 'Nueva FAQ añadida con éxito.', 'success');
                closeFaqModal();
                fetchFaqs();
            } else {
                showToast(data.error || 'Error al guardar la FAQ.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al guardar la FAQ.', 'error');
        }
    });

    // Eliminar FAQ
    const deleteFaq = async (id) => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;

        try {
            const res = await fetch(`/api/faqs/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                showToast('Pregunta frecuente eliminada con éxito.', 'success');
                fetchFaqs();
            } else {
                const data = await res.json();
                showToast(data.error || 'Error al eliminar la FAQ.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error de red al eliminar la FAQ.', 'error');
        }
    };

    // Añadir listener para abrir modal FAQ nuevo
    if (btnAddFaq) {
        btnAddFaq.addEventListener('click', () => openFaqModal());
    }

    // Registrar event listeners de pestañas de Disponibilidad y FAQs
    tabAvailability.addEventListener('click', () => switchTab('availability'));
    tabFaqs.addEventListener('click', () => switchTab('faqs'));
    
    // Inicializar página
    checkAuth();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
} else {
    initAdmin();
}
