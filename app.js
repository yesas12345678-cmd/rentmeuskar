/**
 * RentMeUskar - Lógica de Aplicación
 * Sitio web de alquiler de furgonetas sin conductor en Huéscar
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // CONFIGURACIÓN CENTRALIZADA
    const CONFIG = {
        whatsappNumber: '34614767411', // Teléfono del propietario con prefijo de España
        prices: {
            sin: {
                medium: { name: 'Ford Transit Custom L2H2 (8m³)', price: 79.00 }, // SIN Conductor Base
                large: { name: 'MAN TGE L4H3 Gran Volumen (14m³)', price: 107.44 } // SIN Conductor Base
            },
            con: {
                medium: { name: 'Ford Transit Custom L2H2 (8m³)', minPrice: 50.00, kmPrice: 1.00 }, // CON Conductor Base
                large: { name: 'MAN TGE L4H3 Gran Volumen (14m³)', minPrice: 60.00, kmPrice: 1.40 } // CON Conductor Base
            }
        }
    };

    // ELEMENTOS DEL DOM
    const header = document.getElementById('header');
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const navbar = document.getElementById('navbar');
    const navLinks = document.querySelectorAll('.nav-link');
    const selectVanBtns = document.querySelectorAll('.select-van-btn');
    
    // Elementos de la Calculadora
    const calcForm = document.getElementById('booking-calculator-form');
    const vanSelect = document.getElementById('calc-van-select');
    
    // Modalidades
    const modeSin = document.getElementById('mode-sin-conductor');
    const modeCon = document.getElementById('mode-con-conductor');
    const labelModeSin = document.getElementById('label-mode-sin');
    const labelModeCon = document.getElementById('label-mode-con');
    
    // Contenedores condicionales
    const conConductorFields = document.getElementById('calc-con-conductor-fields');
    const extrasSection = document.getElementById('calc-extras-section');
    const fianzaNote = document.getElementById('calc-fianza-note');
    
    // Parámetros Con Conductor
    const kmsEstimate = document.getElementById('calc-kms-estimate');
    const waitHours = document.getElementById('calc-wait-hours');

    const dateStart = document.getElementById('calc-date-start');
    const timeStart = document.getElementById('calc-time-start');
    const dateEnd = document.getElementById('calc-date-end');
    const timeEnd = document.getElementById('calc-time-end');
    const extraGps = document.getElementById('calc-extra-gps');
    const extraDriver = document.getElementById('calc-extra-driver');
    const extraMoving = document.getElementById('calc-extra-moving');
    const clientName = document.getElementById('calc-name');
    
    // Resumen de la Calculadora
    const summaryDays = document.getElementById('summary-days');
    const summaryBasePrice = document.getElementById('summary-base-price');
    const summaryExtrasPrice = document.getElementById('summary-extras-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');

    // Elementos de FAQ
    const faqQuestions = document.querySelectorAll('.faq-question');

    // TPV Form
    const tpvForm = document.getElementById('tpv-form');

    // Variables de Estado de Reserva y Calendario
    let pickerStart, pickerEnd;
    let disabledRanges = [];
    let pendingBookingData = null;

    /* ==========================================================================
       1. NAVEGACIÓN Y EFECTOS HEADER
       ========================================================================== */
    
    // Cambiar estilo de la cabecera al hacer scroll
    const checkScroll = () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };
    
    window.addEventListener('scroll', checkScroll);
    checkScroll(); // Ejecutar al cargar

    // Menú móvil (Hamburger)
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenuToggle.classList.toggle('active');
        navbar.classList.toggle('active');
    });

    // Cerrar menú móvil al hacer clic en un enlace
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuToggle.classList.remove('active');
            navbar.classList.remove('active');
            
            // Actualizar clase activa del enlace
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });

    // Cerrar menú móvil al hacer clic fuera del mismo
    document.addEventListener('click', (e) => {
        if (navbar.classList.contains('active') && 
            !navbar.contains(e.target) && 
            !mobileMenuToggle.contains(e.target)) {
            mobileMenuToggle.classList.remove('active');
            navbar.classList.remove('active');
        }
    });

    // Resaltar sección activa en el menú de navegación según el scroll
    const sections = document.querySelectorAll('section[id]');
    
    const highlightNavOnScroll = () => {
        const scrollY = window.scrollY;
        
        sections.forEach(current => {
            const sectionHeight = current.offsetHeight;
            const sectionTop = current.offsetTop - 140; // Compensar altura del header
            const sectionId = current.getAttribute('id');
            
            if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
                document.querySelector(`.nav-link[href*=${sectionId}]`)?.classList.add('active');
            } else {
                document.querySelector(`.nav-link[href*=${sectionId}]`)?.classList.remove('active');
            }
        });
    };
    
    window.addEventListener('scroll', highlightNavOnScroll);

    /* ==========================================================================
       2. REVELADO AL HACER SCROLL (INTERSECTION OBSERVER)
       ========================================================================== */
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target); // Solo animar una vez
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    /* ==========================================================================
       3. INTEGRACIÓN DE FLATPICKR (CALENDARIO DE DISPONIBILIDAD)
       ========================================================================== */
    
    const initFlatpickr = () => {
        pickerStart = flatpickr("#calc-date-start", {
            locale: "es",
            minDate: "today",
            dateFormat: "Y-m-d",
            disableMobile: "true",
            onChange: function(selectedDates, dateStr, instance) {
                pickerEnd.set("minDate", dateStr);
                calculatePrice();
            }
        });

        pickerEnd = flatpickr("#calc-date-end", {
            locale: "es",
            minDate: "today",
            dateFormat: "Y-m-d",
            disableMobile: "true",
            onChange: function(selectedDates, dateStr, instance) {
                calculatePrice();
            }
        });
    };

    initFlatpickr();

    // Obtener fechas ocupadas de la furgoneta seleccionada (solo aplica a Sin Conductor)
    const updateCalendarAvailability = async () => {
        const vanType = vanSelect.value;
        const mode = document.querySelector('input[name="rental-mode"]:checked').value;
        
        if (!vanType) return;
        
        if (mode === 'con') {
            // Con conductor no tiene bloqueo de fechas reservadas
            pickerStart.set('disable', []);
            pickerEnd.set('disable', []);
            return;
        }
        
        try {
            const response = await fetch(`/api/bookings/unavailable-dates?van_type=${vanType}`);
            if (response.ok) {
                const ranges = await response.json();
                
                // Mapear al formato esperado por Flatpickr: [{from: 'YYYY-MM-DD', to: 'YYYY-MM-DD'}]
                const disableDates = ranges.map(range => ({
                    from: range.from,
                    to: range.to
                }));
                
                pickerStart.set('disable', disableDates);
                pickerEnd.set('disable', disableDates);
            }
        } catch (err) {
            console.error('Error al obtener disponibilidad de fechas:', err);
        }
    };

    vanSelect.addEventListener('change', updateCalendarAvailability);

    /* ==========================================================================
       4. LÓGICA DE LA CALCULADORA DE PRESUPUESTO
       ========================================================================== */
    
    const calculatePrice = () => {
        const vanType = vanSelect.value;
        const mode = document.querySelector('input[name="rental-mode"]:checked').value;
        
        // Si no hay furgoneta seleccionada, poner valores a cero
        if (!vanType) {
            summaryDays.textContent = '0 días';
            summaryBasePrice.textContent = '0,00 €';
            summaryExtrasPrice.textContent = '0,00 €';
            summaryTotalPrice.textContent = '0,00 €';
            return;
        }

        // Toggle UI elements based on modality
        if (mode === 'sin') {
            conConductorFields.style.display = 'none';
            extrasSection.style.display = 'block';
            fianzaNote.style.display = 'block';
            
            // Labels de Sin Conductor
            document.getElementById('summary-days-label').textContent = 'Días de alquiler:';
            document.querySelector('.price-summary-box .summary-row:nth-child(2) span:first-child').textContent = 'Subtotal Base (excl. IVA):';
            document.querySelector('.price-summary-box .summary-row:nth-child(3) span:first-child').textContent = 'IVA (21%):';
        } else {
            conConductorFields.style.display = 'block';
            extrasSection.style.display = 'none';
            fianzaNote.style.display = 'none';
            
            // Labels de Con Conductor
            document.getElementById('summary-days-label').textContent = 'Estimación:';
            document.querySelector('.price-summary-box .summary-row:nth-child(2) span:first-child').textContent = 'Subtotal Base (excl. IVA):';
            document.querySelector('.price-summary-box .summary-row:nth-child(3) span:first-child').textContent = 'IVA (21%):';
        }

        // Calcular número de días
        const startVal = dateStart.value;
        const endVal = dateEnd.value;
        if (!startVal || !endVal) return;

        const start = new Date(startVal);
        const end = new Date(endVal);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const days = diffDays > 0 ? diffDays : 1;

        let baseTaxable = 0;
        let vatAmount = 0;
        let totalEstimated = 0;

        if (mode === 'sin') {
            const baseDailyRate = CONFIG.prices.sin[vanType].price;
            let totalBase = baseDailyRate * days;
            
            // Descuento del 5% a partir de 3 días
            if (days >= 3) {
                totalBase = totalBase * 0.95;
            }

            // Calcular extras
            let totalExtras = 0;
            if (extraGps.checked) {
                totalExtras += parseFloat(extraGps.value) * days; // 5€ por día
            }
            if (extraDriver.checked) {
                totalExtras += parseFloat(extraDriver.value) * days; // 8€ por día
            }
            if (extraMoving.checked) {
                totalExtras += parseFloat(extraMoving.value); // 10€ pago único
            }

            baseTaxable = totalBase + totalExtras;
            vatAmount = baseTaxable * 0.21;
            totalEstimated = baseTaxable + vatAmount;

            summaryDays.textContent = `${days} ${days === 1 ? 'día' : 'días'}${days >= 3 ? ' (5% desc.)' : ''}`;
        } else {
            // CON CONDUCTOR
            const baseMinRate = CONFIG.prices.con[vanType].minPrice;
            const kmRate = CONFIG.prices.con[vanType].kmPrice;
            
            const kms = parseInt(kmsEstimate.value) || 20;
            const wait = parseFloat(waitHours.value) || 0;
            
            let extraKmCost = 0;
            if (kms > 20) {
                extraKmCost = (kms - 20) * kmRate;
            }
            
            const waitCost = wait * 30.00;
            
            baseTaxable = baseMinRate + extraKmCost + waitCost;
            vatAmount = baseTaxable * 0.21;
            totalEstimated = baseTaxable + vatAmount;

            summaryDays.textContent = `${kms} km / ${wait} h espera`;
        }

        // Renderizar valores en pantalla
        summaryBasePrice.textContent = `${baseTaxable.toFixed(2)} €`;
        summaryExtrasPrice.textContent = `${vatAmount.toFixed(2)} €`;
        summaryTotalPrice.textContent = `${totalEstimated.toFixed(2)} €`;
    };

    // Event handlers para los selectores de modalidad
    const handleModeChange = (e) => {
        // Toggle visual active state
        if (modeSin.checked) {
            labelModeSin.classList.add('active');
            labelModeSin.style.borderColor = 'var(--color-neon)';
            labelModeSin.style.background = 'rgba(130, 209, 5, 0.05)';
            labelModeSin.querySelector('i').style.color = 'var(--color-neon)';
            labelModeSin.querySelector('span').style.color = '#fff';

            labelModeCon.classList.remove('active');
            labelModeCon.style.borderColor = 'rgba(255,255,255,0.1)';
            labelModeCon.style.background = 'rgba(255,255,255,0.02)';
            labelModeCon.querySelector('i').style.color = 'var(--text-secondary)';
            labelModeCon.querySelector('span').style.color = 'var(--text-secondary)';
        } else {
            labelModeCon.classList.add('active');
            labelModeCon.style.borderColor = 'var(--color-neon)';
            labelModeCon.style.background = 'rgba(130, 209, 5, 0.05)';
            labelModeCon.querySelector('i').style.color = 'var(--color-neon)';
            labelModeCon.querySelector('span').style.color = '#fff';

            labelModeSin.classList.remove('active');
            labelModeSin.style.borderColor = 'rgba(255,255,255,0.1)';
            labelModeSin.style.background = 'rgba(255,255,255,0.02)';
            labelModeSin.querySelector('i').style.color = 'var(--text-secondary)';
            labelModeSin.querySelector('span').style.color = 'var(--text-secondary)';
        }
        
        updateCalendarAvailability();
        calculatePrice();
    };

    modeSin.addEventListener('change', handleModeChange);
    modeCon.addEventListener('change', handleModeChange);
    
    // Inputs de con conductor
    kmsEstimate.addEventListener('input', calculatePrice);
    waitHours.addEventListener('input', calculatePrice);

    // Event listeners para recálculo instantáneo
    vanSelect.addEventListener('change', calculatePrice);
    timeStart.addEventListener('change', calculatePrice);
    timeEnd.addEventListener('change', calculatePrice);
    extraGps.addEventListener('change', calculatePrice);
    extraDriver.addEventListener('change', calculatePrice);
    extraMoving.addEventListener('change', calculatePrice);

    /* ==========================================================================
       5. BOTONES SELECCIONAR FLOTA -> FORMULARIO
       ========================================================================== */
    selectVanBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const vanType = btn.getAttribute('data-van');
            
            // Seleccionar en el dropdown
            vanSelect.value = vanType;
            
            // Actualizar disponibilidad del calendario para esa furgoneta
            updateCalendarAvailability();
            
            // Recalcular
            calculatePrice();
            
            // Hacer scroll hasta el formulario
            const targetSection = document.getElementById('calculadora');
            const headerOffset = 110;
            const elementPosition = targetSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Enfocar el selector
            vanSelect.focus();
        });
    });

    /* ==========================================================================
       6. SISTEMA DE AUTENTICACIÓN DEL CLIENTE (MODALES)
       ========================================================================== */
    
    // Funciones globales de modales
    window.openAuthModal = (modalId) => {
        document.getElementById(modalId).style.display = 'flex';
    };
    
    window.closeAuthModal = (modalId) => {
        document.getElementById(modalId).style.display = 'none';
    };
    
    window.switchAuthModal = (closeId, openId) => {
        window.closeAuthModal(closeId);
        window.openAuthModal(openId);
    };

    // Actualizar NavBar según estado de sesión
    const updateAuthUI = async () => {
        const token = localStorage.getItem('user_token');
        const authSection = document.getElementById('user-auth-section');
        
        if (!token) {
            authSection.innerHTML = `
                <button class="btn btn-secondary btn-sm" onclick="openAuthModal('login-modal')" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">
                    <i class="fa-solid fa-user-lock"></i> Entrar
                </button>
            `;
            return;
        }
        
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                authSection.innerHTML = `
                    <button class="btn btn-secondary btn-sm" onclick="openClientArea()" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; border-color: var(--color-neon); color: var(--color-neon);">
                        <i class="fa-solid fa-user-circle"></i> Mi Panel (${user.name.split(' ')[0]})
                    </button>
                `;
                
                if (!clientName.value) {
                    clientName.value = user.name;
                }
            } else {
                localStorage.removeItem('user_token');
                updateAuthUI();
            }
        } catch (err) {
            console.error('Error al verificar perfil de sesión:', err);
        }
    };

    // Event listener para login modal botón en header
    document.getElementById('btn-login-modal').addEventListener('click', () => {
        window.openAuthModal('login-modal');
    });

    // Login Form Submit
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.user && data.user.is_admin) {
                    localStorage.setItem('admin_token', data.token);
                    window.location.href = '/admin';
                    return;
                }
                
                localStorage.setItem('user_token', data.token);
                window.closeAuthModal('login-modal');
                updateAuthUI();
                alert('Sesión iniciada correctamente.');
            } else {
                alert(data.error || 'Error al iniciar sesión.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor.');
        }
    });

    // Register Form Submit
    document.getElementById('register-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const dni = document.getElementById('reg-dni').value;
        const password = document.getElementById('reg-password').value;
        
        if (password.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, phone, dni })
            });
            const data = await res.json();
            if (res.ok) {
                localStorage.setItem('user_token', data.token);
                window.closeAuthModal('register-modal');
                updateAuthUI();
                alert('Registro completado con éxito.');
            } else {
                alert(data.error || 'Error al registrarse.');
            }
        } catch (err) {
            console.error(err);
            alert('Error de conexión con el servidor.');
        }
    });

    // Abrir Panel de Área de Cliente
    window.openClientArea = async () => {
        const token = localStorage.getItem('user_token');
        if (!token) return;
        
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Token expirado');
            const user = await res.json();
            
            document.getElementById('client-user-info').textContent = `Conectado como: ${user.name} (${user.email}) | DNI: ${user.dni}`;
            
            // Obtener reservas del cliente
            const bookingsRes = await fetch(`/api/bookings?user_id=${user.id}`);
            const bookingsList = await bookingsRes.json();
            
            const tbody = document.getElementById('client-bookings-tbody');
            if (bookingsList.length === 0) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem;">No tienes reservas registradas.</td></tr>`;
            } else {
                tbody.innerHTML = '';
                bookingsList.forEach(b => {
                    const tr = document.createElement('tr');
                    
                    const statusLabel = b.status === 'pending' ? 'Pendiente' : b.status === 'confirmed' ? 'Confirmado' : 'Cancelado';
                    const paymentLabel = b.payment_status === 'paid' ? 'Pagado' : 'Pendiente';
                    const fianzaLabel = b.fianza_status === 'paid' ? 'Retenida (500€)' : b.fianza_status === 'refunded' ? 'Devuelta' : 'Pendiente';
                    
                    const formatDate = (dateStr) => {
                        const cleanDate = dateStr.split('T')[0];
                        const [year, month, day] = cleanDate.split('-');
                        return `${day}/${month}/${year}`;
                    };
                    
                    tr.innerHTML = `
                        <td>#${b.id}</td>
                        <td><strong>${b.van_name.split(' ')[0]} ${b.van_name.split(' ')[1] || ''}</strong></td>
                        <td>${formatDate(b.pickup_date)} ${b.pickup_time}</td>
                        <td>${formatDate(b.return_date)} ${b.return_time}</td>
                        <td><strong>${parseFloat(b.total_price).toFixed(2)} €</strong></td>
                        <td><span style="font-size: 0.8rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.05);">${fianzaLabel}</span></td>
                        <td><span style="font-size: 0.8rem; font-weight: 700; color: ${b.status === 'confirmed' ? '#82d105' : b.status === 'pending' ? '#ffb703' : '#ff4d6d'};">${statusLabel}</span></td>
                        <td>
                            ${b.status === 'confirmed' ? `
                                <button class="client-doc-btn" onclick="window.open('/contract/${b.id}', '_blank')"><i class="fa-solid fa-file-signature"></i> Contrato</button>
                                <button class="client-doc-btn" onclick="window.open('/invoice/${b.id}', '_blank')"><i class="fa-solid fa-file-invoice-dollar"></i> Factura</button>
                            ` : '<span style="color: var(--text-muted); font-size: 0.75rem;">Pendiente</span>'}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
            
            window.openAuthModal('client-modal');
        } catch (err) {
            console.error(err);
            localStorage.removeItem('user_token');
            updateAuthUI();
        }
    };

    // Cerrar sesión
    document.getElementById('btn-client-logout').addEventListener('click', () => {
        localStorage.removeItem('user_token');
        window.closeAuthModal('client-modal');
        updateAuthUI();
        clientName.value = '';
    });

    updateAuthUI(); // Comprobar sesión al arrancar

    /* ==========================================================================
       7. ENVIAR FORMULARIO, PASARELA TPV Y WHATSAPP FLOW
       ========================================================================== */
    
    calcForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Validar autenticación
        const token = localStorage.getItem('user_token');
        if (!token) {
            alert('Por favor, inicia sesión o regístrate para solicitar una reserva.');
            window.openAuthModal('login-modal');
            return;
        }

        const vanType = vanSelect.value;
        if (!vanType) {
            alert('Por favor, selecciona un tipo de furgoneta.');
            vanSelect.focus();
            return;
        }

        const nameValue = clientName.value.trim();
        if (!nameValue) {
            alert('Por favor, introduce tu nombre.');
            clientName.focus();
            return;
        }

        // Obtener datos del alquiler
        const rentalMode = document.querySelector('input[name="rental-mode"]:checked').value;
        const vanName = CONFIG.prices[rentalMode][vanType].name;
        const pickupDateStr = dateStart.value;
        const pickupTimeStr = timeStart.value;
        const returnDateStr = dateEnd.value;
        const returnTimeStr = timeEnd.value;
        
        const start = new Date(pickupDateStr);
        const end = new Date(returnDateStr);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const days = diffDays > 0 ? diffDays : 1;

        // Recopilar extras activos
        const selectedExtras = [];
        if (rentalMode === 'sin') {
            if (extraGps.checked) selectedExtras.push('GPS Navegador (+5€/día)');
            if (extraDriver.checked) selectedExtras.push('Segundo Conductor (+8€/día)');
            if (extraMoving.checked) selectedExtras.push('Kit Mudanza (+10€ pago único)');
        }
        
        const totalPriceText = summaryTotalPrice.textContent;
        const totalPriceNum = parseFloat(totalPriceText.replace(/[^\d.,]/g, '').replace(',', '.'));

        // Obtener ID del usuario
        let user;
        try {
            const res = await fetch('/api/auth/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error();
            user = await res.json();
        } catch (err) {
            alert('Tu sesión ha expirado. Por favor entra de nuevo.');
            localStorage.removeItem('user_token');
            updateAuthUI();
            return;
        }

        // Construir datos temporales de reserva
        pendingBookingData = {
            name: nameValue,
            van_type: vanType,
            van_name: vanName,
            pickup_date: pickupDateStr,
            pickup_time: pickupTimeStr,
            return_date: returnDateStr,
            return_time: returnTimeStr,
            days: days,
            extras: selectedExtras,
            total_price: totalPriceNum,
            user_id: user.id,
            rental_mode: rentalMode,
            estimated_kms: rentalMode === 'con' ? parseInt(kmsEstimate.value) : 0,
            waiting_hours: rentalMode === 'con' ? parseFloat(waitHours.value) : 0.00
        };

        // DETERMINACIÓN DE FLUJO SEGÚN DURACIÓN (1 semana o menos vs más de 1 semana)
        if (days <= 7) {
            // FLUJO A: Pago online obligatorio de alquiler + fianza de 500€ (solo si es sin conductor)
            const fianzaAmount = rentalMode === 'sin' ? 500 : 0;
            document.getElementById('tpv-rent-amount').textContent = `${totalPriceNum.toFixed(2)} €`;
            document.getElementById('tpv-total-amount').textContent = `${(totalPriceNum + fianzaAmount).toFixed(2)} €`;
            
            // Rellenar por defecto titular
            document.getElementById('tpv-card-name').value = user.name;
            
            // Mostrar pasarela TPV
            window.openAuthModal('tpv-modal');
        } else {
            // FLUJO B: Reserva sin pago online, gestionado manualmente por WhatsApp
            const submitBtn = document.getElementById('btn-submit-booking');
            const originalBtnHtml = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registrando solicitud...';

            try {
                const finalBookingData = {
                    ...pendingBookingData,
                    status: 'pending',
                    payment_status: 'pending',
                    fianza_status: rentalMode === 'sin' ? 'pending' : 'refunded'
                };

                const response = await fetch('/api/bookings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalBookingData)
                });
                
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error || 'Error al guardar reserva.');
                }

                // Generar mensaje WhatsApp para reserva manual > 1 semana
                const isCon = finalBookingData.rental_mode === 'con';
                const modeLabelText = isCon ? 'CON CONDUCTOR' : 'SIN CONDUCTOR';
                const extraDetailsText = isCon 
                    ? `\n- *Trayecto:* ${finalBookingData.estimated_kms} km estimados` + 
                      `\n- *Espera:* ${finalBookingData.waiting_hours} h de espera`
                    : (finalBookingData.extras.length > 0 ? '\n- *Extras:* ' + finalBookingData.extras.join(', ') : '');

                const messageText = `Hola *RentMeUskar*, me gustaría solicitar una reserva de furgoneta para larga duración (> 1 semana):

*Solicitud de Reserva #${data.booking.id}*
- *Cliente:* ${nameValue} (DNI: ${user.dni})
- *Modalidad:* ${modeLabelText}
- *Vehículo:* ${vanName}
- *Recogida:* ${pickupDateStr} a las ${pickupTimeStr}
- *Devolución:* ${returnDateStr} a las ${returnTimeStr}${extraDetailsText}
- *Duración:* ${isCon ? '-' : days + ' días'}

*Precio estimado total:* ${totalPriceText}
*Fianza establecida:* ${isCon ? '0,00 € (No aplica)' : '500,00 € (Pendiente de cobro/depósito)'}

(Solicitud pendiente de confirmación de disponibilidad del propietario).`;

                const encodedText = encodeURIComponent(messageText);
                const whatsappUrl = `https://api.whatsapp.com/send?phone=${CONFIG.whatsappNumber}&text=${encodedText}`;
                window.open(whatsappUrl, '_blank');
                
                alert('Solicitud registrada. Se ha abierto WhatsApp para que contactes con el propietario y confirmes la reserva.');
            } catch (err) {
                console.error(err);
                alert('Error al procesar la reserva: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnHtml;
            }
        }
    });

    // Procesar pago en la TPV CaixaBank
    tpvForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const tpvSubmitBtn = document.getElementById('tpv-submit-btn');
        const originalBtnHtml = tpvSubmitBtn.innerHTML;
        
        tpvSubmitBtn.disabled = true;
        tpvSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Conectando con Redsys...';
        
        // Simular Redsys CaixaBank
        setTimeout(() => {
            tpvSubmitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Autorizando pago seguro...';
            
            setTimeout(async () => {
                try {
                    const paymentId = 'TPV_' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    const isCon = pendingBookingData.rental_mode === 'con';
                    const fianzaStatus = isCon ? 'refunded' : 'paid';
                    
                    const finalBookingData = {
                        ...pendingBookingData,
                        status: 'confirmed',
                        payment_status: 'paid',
                        fianza_status: fianzaStatus,
                        payment_id: paymentId
                    };
                    
                    const response = await fetch('/api/bookings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(finalBookingData)
                    });
                    
                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Error al guardar reserva.');
                    }
                    
                    alert(`¡PAGO AUTORIZADO CORRECTAMENTE!\nReserva #${data.booking.id} confirmada con éxito.\nReferencia de operación: ${paymentId}`);
                    
                    window.closeAuthModal('tpv-modal');
                    tpvForm.reset();
                    
                    // Bloquear fechas ocupadas inmediatamente
                    updateCalendarAvailability();
                    
                    // Abrir WhatsApp con el recibo
                    const modeLabelText = isCon ? 'CON CONDUCTOR' : 'SIN CONDUCTOR';
                    const extraDetailsText = isCon 
                        ? `\n- *Trayecto:* ${finalBookingData.estimated_kms} km estimados` + 
                          `\n- *Espera:* ${finalBookingData.waiting_hours} h de espera`
                        : (finalBookingData.extras.length > 0 ? '\n- *Extras:* ' + finalBookingData.extras.join(', ') : '');
                    
                    const messageText = `Hola *RentMeUskar*, he completado una reserva y pago online en la web:
                    
*Reserva Confirmada #${data.booking.id}*
- *Cliente:* ${finalBookingData.name}
- *Modalidad:* ${modeLabelText}
- *Vehículo:* ${finalBookingData.van_name}
- *Recogida:* ${finalBookingData.pickup_date} a las ${finalBookingData.pickup_time}
- *Devolución:* ${finalBookingData.return_date} a las ${finalBookingData.return_time}${extraDetailsText}
- *Duración:* ${isCon ? '-' : finalBookingData.days + ' días'}

*Pago Confirmado:*
- *Alquiler:* ${finalBookingData.total_price.toFixed(2)} €
- *Fianza:* ${isCon ? '0,00 € (No aplica)' : '500,00 € (Retenida en TPV)'}
- *Total Operación:* ${(finalBookingData.total_price + (isCon ? 0 : 500)).toFixed(2)} €
- *Código de Operación:* ${paymentId}`;
                    
                    const encodedText = encodeURIComponent(messageText);
                    const whatsappUrl = `https://api.whatsapp.com/send?phone=${CONFIG.whatsappNumber}&text=${encodedText}`;
                    window.open(whatsappUrl, '_blank');
                    
                } catch (err) {
                    console.error(err);
                    alert('Error al registrar la reserva pagada: ' + err.message);
                } finally {
                    tpvSubmitBtn.disabled = false;
                    tpvSubmitBtn.innerHTML = originalBtnHtml;
                }
            }, 1000);
        }, 1500);
    });

    window.cancelTpvPayment = () => {
        if (confirm('¿Deseas cancelar la transacción? Los importes no se cobrarán y la reserva no se registrará.')) {
            window.closeAuthModal('tpv-modal');
            pendingBookingData = null;
        }
    };

    /* ==========================================================================
       8. PREGUNTAS FRECUENTES (FAQ ACORDEÓN)
       ========================================================================== */
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Cerrar todas las FAQ primero para efecto acordeón exclusivo
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // Si la FAQ cliqueada no estaba activa, la abrimos
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });
});
