/**
 * RentMeUskar - Lógica de Aplicación
 * Sitio web de alquiler de furgonetas sin conductor en Huéscar
 */

const initApp = () => {
    
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
    const dynamicExtrasContainer = document.getElementById('calc-dynamic-extras-container');
    const fleetGridContainer = document.getElementById('fleet-grid-container');
    const clientName = document.getElementById('calc-name');
    
    // Resumen de la Calculadora
    const summaryDays = document.getElementById('summary-days');
    const summaryBasePrice = document.getElementById('summary-base-price');
    const summaryExtrasPrice = document.getElementById('summary-extras-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');

    // Elementos de FAQ
    const faqQuestions = document.querySelectorAll('.faq-question');

    // Elementos de Opiniones Verificadas
    const testimonialsGrid = document.getElementById('testimonials-grid');
    const btnOpenReviewModal = document.getElementById('btn-open-review-modal');
    const writeReviewForm = document.getElementById('write-review-form');
    const reviewCodeInput = document.getElementById('review-code-input');
    const reviewNameInput = document.getElementById('review-name-input');
    const reviewCityInput = document.getElementById('review-city-input');
    const reviewRatingInput = document.getElementById('review-rating-input');
    const reviewCommentInput = document.getElementById('review-comment-input');

    // TPV Form
    const tpvForm = document.getElementById('tpv-form');

    // Variables de Estado de Reserva y Calendario
    let pickerStart, pickerEnd;
    let disabledRanges = [];
    let pendingBookingData = null;
    let databaseVans = [];

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

    // Limpiar cualquier almohadilla (#) de la URL en la carga inicial de la página
    if (window.location.hash) {
        history.replaceState(null, null, window.location.pathname);
    }

    // Interceptar todos los enlaces internos que empiezan por # para evitar la almohadilla en la URL
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            
            // Evitar interceptar si apunta a modales o acciones JS específicas
            if (targetId.includes('modal') || this.hasAttribute('data-toggle') || this.classList.contains('custom-modal-close') || this.id.includes('login') || this.id.includes('register')) {
                return;
            }
            
            e.preventDefault();
            
            if (targetId === '#') {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                history.replaceState(null, null, window.location.pathname);
                return;
            }
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 100; // Compensar la cabecera fija
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.scrollY - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Actualizar clase activa del enlace en el menú
                if (this.classList.contains('nav-link')) {
                    navLinks.forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                }
                
                // Cerrar menú móvil
                mobileMenuToggle.classList.remove('active');
                navbar.classList.remove('active');
                
                // Limpiar la URL de hashes para que quede limpia
                history.replaceState(null, null, window.location.pathname);
            }
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
    document.documentElement.classList.add('js');
    const revealElements = document.querySelectorAll('.reveal');
    
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(element => {
        revealObserver.observe(element);
    });

    // Fallback robusto usando scroll clásico y getBoundingClientRect
    const checkRevealFallback = () => {
        revealElements.forEach(element => {
            if (element.classList.contains('active')) return;
            const rect = element.getBoundingClientRect();
            // Si el elemento entra en la pantalla
            if (rect.top < window.innerHeight - 50) {
                element.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', checkRevealFallback);
    // Disparar inmediatamente al cargar para asegurar que la portada y secciones iniciales sean visibles
    setTimeout(checkRevealFallback, 300);
    setTimeout(checkRevealFallback, 800); // Doble disparo de seguridad por si hay retraso en renderizado

    /* ==========================================================================
       3. INTEGRACIÓN DE FLATPICKR (CALENDARIO DE DISPONIBILIDAD)
       ========================================================================== */
    
    const initFlatpickr = () => {
        if (typeof flatpickr === 'undefined') {
            console.warn('Flatpickr no está cargado. Se usarán selectores de fecha nativos.');
            const startEl = document.getElementById('calc-date-start');
            const endEl = document.getElementById('calc-date-end');
            
            if (startEl && endEl) {
                startEl.type = 'date';
                endEl.type = 'date';
                
                const todayStr = new Date().toISOString().split('T')[0];
                startEl.min = todayStr;
                endEl.min = todayStr;
                
                startEl.addEventListener('change', function() {
                    endEl.min = this.value;
                    calculatePrice();
                });
                endEl.addEventListener('change', calculatePrice);
            }
            return;
        }

        pickerStart = flatpickr("#calc-date-start", {
            locale: "es",
            minDate: "today",
            dateFormat: "Y-m-d",
            disableMobile: true,
            onChange: function(selectedDates, dateStr, instance) {
                if (pickerEnd) pickerEnd.set("minDate", dateStr);
                calculatePrice();
            }
        });

        pickerEnd = flatpickr("#calc-date-end", {
            locale: "es",
            minDate: "today",
            dateFormat: "Y-m-d",
            disableMobile: true,
            onChange: function(selectedDates, dateStr, instance) {
                calculatePrice();
            }
        });
    };

    initFlatpickr();

    // Renderizar extras dinámicamente según la furgoneta seleccionada
    const renderDynamicExtras = () => {
        if (!dynamicExtrasContainer) return;
        const vanType = vanSelect.value;
        if (!vanType) return;
        
        const van = databaseVans.find(v => v.van_type === vanType);
        if (!van) return;
        
        let extras = van.custom_extras;
        if (!Array.isArray(extras) || extras.length === 0) {
            extras = [
                { name: 'GPS Navegador', price: 5.00, type: 'daily' },
                { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
                { name: 'Kit Mudanza', price: 10.00, type: 'once' }
            ];
        }
        
        dynamicExtrasContainer.innerHTML = '';
        extras.forEach((extra, index) => {
            const label = document.createElement('label');
            label.className = 'extra-checkbox-card';
            label.id = `card-dynamic-extra-${index}`;
            
            let icon = 'fa-circle-plus';
            const nameLower = extra.name.toLowerCase();
            if (nameLower.includes('gps') || nameLower.includes('navegador') || nameLower.includes('mapa')) {
                icon = 'fa-map-location-dot';
            } else if (nameLower.includes('conductor') || nameLower.includes('chofer') || nameLower.includes('chófer')) {
                icon = 'fa-user-plus';
            } else if (nameLower.includes('mudanza') || nameLower.includes('caja') || nameLower.includes('kit')) {
                icon = 'fa-boxes-packing';
            } else if (nameLower.includes('seguro') || nameLower.includes('cobertura')) {
                icon = 'fa-shield-halved';
            } else if (nameLower.includes('cadenas') || nameLower.includes('nieve')) {
                icon = 'fa-snowflake';
            }
            
            const priceText = extra.type === 'daily' ? `+${parseFloat(extra.price).toFixed(2)}€ / día` : `+${parseFloat(extra.price).toFixed(2)}€ total`;
            
            label.innerHTML = `
                <input type="checkbox" class="calc-dynamic-extra-checkbox" data-index="${index}" data-price="${extra.price}" data-type="${extra.type}" data-name="${extra.name}">
                <div class="extra-content">
                    <i class="fa-solid ${icon}"></i>
                    <span class="extra-name">${extra.name}</span>
                    <span class="extra-price">${priceText}</span>
                </div>
            `;
            
            label.querySelector('input').addEventListener('change', function() {
                if (this.checked) {
                    label.classList.add('active');
                    label.style.borderColor = 'var(--color-neon)';
                    label.style.background = 'rgba(130, 209, 5, 0.05)';
                } else {
                    label.classList.remove('active');
                    label.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    label.style.background = 'rgba(255, 255, 255, 0.02)';
                }
                calculatePrice();
            });
            
            dynamicExtrasContainer.appendChild(label);
        });
    };

    // Cargar catálogo de furgonetas desde la API y renderizar tarjetas públicas dinámicamente
    const loadVans = async () => {
        try {
            const response = await fetch('/api/vans');
            if (response.ok) {
                databaseVans = await response.json();
                
                // Repoblar el selector calc-van-select
                const selectedVal = vanSelect.value;
                vanSelect.innerHTML = '<option value="" disabled selected>-- Elige un modelo --</option>';
                databaseVans.forEach(van => {
                    const opt = document.createElement('option');
                    opt.value = van.van_type;
                    opt.setAttribute('data-price', van.price_sin);
                    opt.textContent = `${van.name} - ${parseFloat(van.price_sin).toFixed(2).replace('.', ',')}€ + IVA / día`;
                    vanSelect.appendChild(opt);
                });
                
                if (selectedVal && databaseVans.some(v => v.van_type === selectedVal)) {
                    vanSelect.value = selectedVal;
                }

                // Renderizar tarjetas de furgonetas activas dinámicamente en el DOM de la página principal
                if (fleetGridContainer) {
                    fleetGridContainer.innerHTML = '';
                    const activeVans = databaseVans.filter(v => v.status === 'active');
                    
                    activeVans.forEach((van, index) => {
                        const article = document.createElement('article');
                        article.className = `van-card reveal${index > 0 ? ' delay-' + index : ''}`;
                        article.id = `card-van-${van.van_type}`;
                        article.style.cursor = 'pointer';
                        
                        const mainImg = (van.images && van.images.length > 0) ? van.images[0] : 'assets/ford_transit_custom.png';
                        
                        let tag = 'Furgoneta';
                        let desc = 'Capacidad de carga y comodidad';
                        let specPayload = '1.000 kg';
                        let specPlazas = '3 plazas';
                        let specExtra = 'Puerta lateral corredera';
                        
                        if (van.van_type === 'medium') {
                            tag = 'Más Popular';
                            desc = 'Capacidad de carga mediana y ágil';
                            specPayload = '1.000 kg';
                            specPlazas = '3 plazas delanteras';
                            specExtra = 'Puerta lateral corredera';
                        } else if (van.van_type === 'large') {
                            tag = 'Gran Volumen';
                            desc = 'Máxima capacidad para grandes portes';
                            specPayload = '1.400 kg';
                            specPlazas = '3 plazas con cabina amplia';
                            specExtra = 'Altura interior para estar de pie';
                        } else {
                            const m3Num = parseFloat(van.m3) || 10;
                            if (m3Num < 6) {
                                tag = 'Compacta';
                                desc = 'Ideal para pequeños traslados urbanos';
                                specPayload = '600 kg';
                                specPlazas = '2 plazas';
                                specExtra = 'Fácil de aparcar';
                            } else if (m3Num > 12) {
                                tag = 'Súper Volumen';
                                desc = 'Para grandes mudanzas y largos trayectos';
                                specPayload = '1.500 kg';
                                specPlazas = '3 plazas';
                                specExtra = 'Espacio de carga optimizado';
                            } else {
                                tag = 'Versátil';
                                desc = 'Perfecto equilibrio entre tamaño y potencia';
                                specPayload = '1.200 kg';
                                specPlazas = '3 plazas';
                                specExtra = 'Fácil conducción';
                            }
                        }
                        
                        article.innerHTML = `
                            <div class="van-image-container" style="position: relative;">
                                <img src="${mainImg}" alt="${van.name}" class="van-image" id="img-van-${van.van_type}">
                                <div class="van-tag ${van.van_type === 'medium' ? 'highlight' : ''}">${tag}</div>
                            </div>
                            <div class="van-details">
                                <h3 class="van-name">${van.name}</h3>
                                <p class="van-model-example">${desc}</p>
                                <ul class="van-specs">
                                    <li><i class="fa-solid fa-box"></i> <strong>${van.m3}</strong> de capacidad</li>
                                    <li><i class="fa-solid fa-weight-hanging"></i> Carga útil: <strong>${specPayload}</strong></li>
                                    <li><i class="fa-solid fa-user"></i> <strong>${specPlazas}</strong></li>
                                    <li><i class="fa-solid fa-circle-check"></i> ${specExtra}</li>
                                </ul>
                                <div class="van-footer">
                                    <div class="van-price">
                                        <span class="price-from">Desde</span>
                                        <span class="price-amount">${parseFloat(van.price_sin).toFixed(2).replace('.', ',')} €</span>
                                        <span class="price-unit">+ IVA / día</span>
                                    </div>
                                    <a href="#calculadora" class="btn btn-secondary btn-sm select-van-btn" data-van="${van.van_type}" id="btn-select-${van.van_type}">Seleccionar</a>
                                </div>
                            </div>
                        `;
                        
                        // Clicar en la tarjeta abre el detalle ampliado
                        article.addEventListener('click', (e) => {
                            if (e.target.closest('.select-van-btn')) return;
                            openVanDetailsModal(van.van_type);
                        });
                        
                        // Clicar en el botón Seleccionar rellena el simulador
                        const selectBtn = article.querySelector('.select-van-btn');
                        if (selectBtn) {
                            selectBtn.addEventListener('click', (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                vanSelect.value = van.van_type;
                                renderDynamicExtras();
                                updateCalendarAvailability();
                                calculatePrice();
                                
                                const calcSection = document.getElementById('calculadora');
                                if (calcSection) {
                                    calcSection.scrollIntoView({ behavior: 'smooth' });
                                }
                            });
                        }
                        
                        fleetGridContainer.appendChild(article);
                    });
                }

                // Vincular galerías de imágenes de puntitos interactivos en el DOM recién creado
                databaseVans.forEach(van => {
                    const card = document.getElementById('card-van-' + van.van_type);
                    if (!card) return;

                    const imgEl = card.querySelector('.van-image');
                    if (!imgEl) return;

                    imgEl.style.transition = 'opacity 0.15s ease-in-out';

                    if (van.images && van.images.length > 0) {
                        imgEl.src = van.images[0];

                        if (van.images.length > 1) {
                            let dotsContainer = card.querySelector('.van-gallery-dots');
                            if (!dotsContainer) {
                                dotsContainer = document.createElement('div');
                                dotsContainer.className = 'van-gallery-dots';
                                dotsContainer.style.position = 'absolute';
                                dotsContainer.style.bottom = '12px';
                                dotsContainer.style.left = '50%';
                                dotsContainer.style.transform = 'translateX(-50%)';
                                dotsContainer.style.display = 'flex';
                                dotsContainer.style.gap = '6px';
                                dotsContainer.style.zIndex = '10';
                                dotsContainer.style.background = 'rgba(7, 14, 36, 0.6)';
                                dotsContainer.style.padding = '4px 8px';
                                dotsContainer.style.borderRadius = '10px';
                                dotsContainer.style.backdropFilter = 'blur(4px)';
                                dotsContainer.style.border = '1px solid rgba(255,255,255,0.05)';

                                const imgContainer = card.querySelector('.van-image-container');
                                if (imgContainer) {
                                    imgContainer.style.position = 'relative';
                                    imgContainer.appendChild(dotsContainer);
                                }
                            }

                            dotsContainer.innerHTML = '';
                            van.images.forEach((imgUrl, imgIndex) => {
                                const dot = document.createElement('span');
                                dot.style.width = '6px';
                                dot.style.height = '6px';
                                dot.style.borderRadius = '50%';
                                dot.style.background = imgIndex === 0 ? 'var(--color-neon)' : 'rgba(255, 255, 255, 0.4)';
                                dot.style.cursor = 'pointer';
                                dot.style.transition = 'all 0.2s ease';

                                dot.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    imgEl.style.opacity = '0';
                                    setTimeout(() => {
                                        imgEl.src = imgUrl;
                                        imgEl.style.opacity = '1';
                                    }, 150);

                                    Array.from(dotsContainer.children).forEach((d, idx) => {
                                        d.style.background = idx === imgIndex ? 'var(--color-neon)' : 'rgba(255, 255, 255, 0.4)';
                                        d.style.transform = idx === imgIndex ? 'scale(1.2)' : 'scale(1)';
                                    });
                                });

                                dotsContainer.appendChild(dot);
                            });
                        }
                    }
                });
                
                renderDynamicExtras();
            } else {
                console.error('Error al descargar catálogo de furgonetas.');
                useStaticVansFallback();
            }
        } catch (err) {
            console.error('Error de red al conectar con el servidor:', err);
            useStaticVansFallback();
        }
    };

    const useStaticVansFallback = () => {
        databaseVans = [
            { van_type: 'medium', name: 'Ford Transit Custom L2H2 (8m³)', plate: '3681 MCC', m3: '8m³', price_sin: 79.00, min_price_con: 50.00, km_price_con: 1.00, custom_extras: [
                { name: 'GPS Navegador', price: 5.00, type: 'daily' },
                { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
                { name: 'Kit Mudanza', price: 10.00, type: 'once' }
            ]},
            { van_type: 'large', name: 'MAN TGE L4H3 Gran Volumen (14m³)', plate: '3758 MDW', m3: '14m³', price_sin: 107.44, min_price_con: 60.00, km_price_con: 1.40, custom_extras: [
                { name: 'GPS Navegador', price: 5.00, type: 'daily' },
                { name: 'Segundo Conductor', price: 8.00, type: 'daily' },
                { name: 'Kit Mudanza', price: 10.00, type: 'once' }
            ]}
        ];
    };

    loadVans();

    // Obtener fechas ocupadas de la furgoneta seleccionada (solo aplica a Sin Conductor)
    const updateCalendarAvailability = async () => {
        const vanType = vanSelect.value;
        const modeInput = document.querySelector('input[name="rental-mode"]:checked');
        const mode = modeInput ? modeInput.value : 'sin';
        
        if (!vanType) return;
        if (typeof flatpickr === 'undefined' || !pickerStart || !pickerEnd) return;
        
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
        const modeInput = document.querySelector('input[name="rental-mode"]:checked');
        const mode = modeInput ? modeInput.value : 'sin';
        
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

        const van = databaseVans.find(v => v.van_type === vanType);

        if (mode === 'sin') {
            if (days > 7) {
                summaryDays.textContent = `${days} días (> 1 sem.)`;
                summaryBasePrice.textContent = 'A consultar';
                summaryExtrasPrice.textContent = 'A consultar';
                summaryTotalPrice.textContent = 'A consultar';
                
                const submitBtn = document.getElementById('btn-submit-booking');
                if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Reservar por WhatsApp (Larga Duración)';
                return;
            }

            const baseDailyRate = van ? parseFloat(van.price_sin) : (vanType === 'medium' ? 79.00 : 107.44);
            let totalBase = baseDailyRate * days;
            
            // Descuento del 5% a partir de 3 días (máximo 1 semana)
            if (days >= 3 && days <= 7) {
                totalBase = totalBase * 0.95;
            }

            // Calcular extras dinámicos
            let totalExtras = 0;
            const checkedBoxes = document.querySelectorAll('.calc-dynamic-extra-checkbox:checked');
            checkedBoxes.forEach(box => {
                const price = parseFloat(box.getAttribute('data-price')) || 0;
                const type = box.getAttribute('data-type');
                if (type === 'daily') {
                    totalExtras += price * days;
                } else {
                    totalExtras += price;
                }
            });

            baseTaxable = totalBase + totalExtras;
            vatAmount = baseTaxable * 0.21;
            totalEstimated = baseTaxable + vatAmount;

            summaryDays.textContent = `${days} ${days === 1 ? 'día' : 'días'}${days >= 3 ? ' (5% desc.)' : ''}`;
        } else {
            // CON CONDUCTOR
            const baseMinRate = van ? parseFloat(van.min_price_con) : (vanType === 'medium' ? 50.00 : 60.00);
            const kmRate = van ? parseFloat(van.km_price_con) : (vanType === 'medium' ? 1.00 : 1.40);
            
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

        // Actualizar texto del botón de enviar
        const submitBtn = document.getElementById('btn-submit-booking');
        if (submitBtn) {
            if (mode === 'con') {
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Solicitar por WhatsApp (Sin pago online)';
            } else if (days > 7) {
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Reservar por WhatsApp (Larga Duración)';
            } else {
                submitBtn.innerHTML = '<i class="fa-solid fa-credit-card"></i> Pagar y Reservar Online';
            }
        }
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

    // Forzar el click manual en las etiquetas en lugar del radio por bugs de navegadores móviles
    labelModeSin.addEventListener('click', () => {
        modeSin.checked = true;
        handleModeChange();
    });
    labelModeCon.addEventListener('click', () => {
        modeCon.checked = true;
        handleModeChange();
    });

    modeSin.addEventListener('change', handleModeChange);
    modeCon.addEventListener('change', handleModeChange);
    
    // Inputs de con conductor
    kmsEstimate.addEventListener('input', calculatePrice);
    waitHours.addEventListener('input', calculatePrice);

    // Event listeners para recálculo instantáneo
    // Event listeners para recálculo instantáneo
    vanSelect.addEventListener('change', () => {
        renderDynamicExtras();
        updateCalendarAvailability();
        calculatePrice();
    });
    timeStart.addEventListener('change', calculatePrice);
    timeEnd.addEventListener('change', calculatePrice);

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
                    
                    const photosBtn = (b.photos_before && b.photos_before.length > 0) || (b.photos_after && b.photos_after.length > 0)
                        ? `<button class="client-doc-btn" onclick='window.openClientPhotosModal(${JSON.stringify(b.photos_before || [])}, ${JSON.stringify(b.photos_after || [])})'><i class="fa-solid fa-camera"></i> Fotos</button>`
                        : '';
                    
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
                                ${photosBtn}
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

    // Modal de Fotos de Inspección para el Cliente
    window.openClientPhotosModal = (beforeUrls, afterUrls) => {
        const beforeContainer = document.getElementById('client-photos-before-container');
        const afterContainer = document.getElementById('client-photos-after-container');
        if (!beforeContainer || !afterContainer) return;
        
        beforeContainer.innerHTML = '';
        afterContainer.innerHTML = '';
        
        if (!beforeUrls || beforeUrls.length === 0) {
            beforeContainer.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted);">Sin fotos registradas de antes del alquiler.</span>';
        } else {
            beforeUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '6px';
                img.style.cursor = 'pointer';
                img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                img.onclick = () => window.open(url, '_blank');
                beforeContainer.appendChild(img);
            });
        }
        
        if (!afterUrls || afterUrls.length === 0) {
            afterContainer.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted);">Sin fotos de devolución registradas.</span>';
        } else {
            afterUrls.forEach(url => {
                const img = document.createElement('img');
                img.src = url;
                img.style.width = '60px';
                img.style.height = '60px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '6px';
                img.style.cursor = 'pointer';
                img.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                img.onclick = () => window.open(url, '_blank');
                afterContainer.appendChild(img);
            });
        }
        
        window.openAuthModal('client-photos-modal');
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
        const van = databaseVans.find(v => v.van_type === vanType);
        const vanName = van ? van.name : (vanType === 'medium' ? 'Ford Transit Custom L2H2 (8m³)' : 'MAN TGE L4H3 Gran Volumen (14m³)');
        const pickupDateStr = dateStart.value;
        const pickupTimeStr = timeStart.value;
        const returnDateStr = dateEnd.value;
        const returnTimeStr = timeEnd.value;
        
        const start = new Date(pickupDateStr);
        const end = new Date(returnDateStr);
        const diffTime = end - start;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const days = diffDays > 0 ? diffDays : 1;

        // Recopilar extras activos dinámicamente
        const selectedExtras = [];
        if (rentalMode === 'sin') {
            const checkedBoxes = document.querySelectorAll('.calc-dynamic-extra-checkbox:checked');
            checkedBoxes.forEach(box => {
                const name = box.getAttribute('data-name');
                const price = parseFloat(box.getAttribute('data-price')) || 0;
                const type = box.getAttribute('data-type');
                const label = type === 'daily' ? `(+${price.toFixed(2)}€/día)` : `(+${price.toFixed(2)}€ pago único)`;
                selectedExtras.push(`${name} ${label}`);
            });
        }
        
        const totalPriceText = summaryTotalPrice.textContent;
        const totalPriceNum = totalPriceText.includes('A consultar') ? 0.00 : parseFloat(totalPriceText.replace(/[^\d.,]/g, '').replace(',', '.'));

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

        // DETERMINACIÓN DE FLUJO SEGÚN DURACIÓN Y MODALIDAD (Con Conductor nunca paga online)
        if (days <= 7 && rentalMode === 'sin') {
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

                // Generar mensaje WhatsApp para reserva manual
                const isCon = finalBookingData.rental_mode === 'con';
                const modeLabelText = isCon ? 'CON CONDUCTOR' : 'SIN CONDUCTOR';
                const extraDetailsText = isCon 
                    ? `\n- *Trayecto:* ${finalBookingData.estimated_kms} km estimados` + 
                      `\n- *Espera:* ${finalBookingData.waiting_hours} h de espera`
                    : (finalBookingData.extras.length > 0 ? '\n- *Extras:* ' + finalBookingData.extras.join(', ') : '');

                let messageText = '';
                if (isCon) {
                    messageText = `Hola *RentMeUskar*, me gustaría solicitar una reserva de furgoneta *CON CONDUCTOR*:\n\n` +
                        `*Solicitud de Reserva #${data.booking.id}*\n` +
                        `- *Cliente:* ${nameValue} (DNI: ${user.dni})\n` +
                        `- *Vehículo:* ${vanName}\n` +
                        `- *Recogida:* ${pickupDateStr} a las ${pickupTimeStr}\n` +
                        `- *Devolución:* ${returnDateStr} a las ${returnTimeStr}\n` +
                        `- *Trayecto:* ${finalBookingData.estimated_kms} km estimados\n` +
                        `- *Espera:* ${finalBookingData.waiting_hours} h de espera\n\n` +
                        `*Precio estimado total:* ${totalPriceText}\n` +
                        `*Fianza:* No aplica (Alquiler con chofer)\n\n` +
                        `¿Tenéis disponibilidad para este servicio? Quedo a la espera de confirmación.`;
                } else {
                    messageText = `Hola *RentMeUskar*, me gustaría solicitar una reserva de furgoneta para larga duración (> 1 semana):\n\n` +
                        `*Solicitud de Reserva #${data.booking.id}*\n` +
                        `- *Cliente:* ${nameValue} (DNI: ${user.dni})\n` +
                        `- *Modalidad:* ${modeLabelText}\n` +
                        `- *Vehículo:* ${vanName}\n` +
                        `- *Recogida:* ${pickupDateStr} a las ${pickupTimeStr}\n` +
                        `- *Devolución:* ${returnDateStr} a las ${returnTimeStr}${extraDetailsText}\n` +
                        `- *Duración:* ${days} días\n\n` +
                        `*Precio estimado total:* ${totalPriceText}\n` +
                        `*Fianza:* 500,00 € (Pendiente de cobro/depósito)\n\n` +
                        `(Solicitud pendiente de confirmación de disponibilidad del propietario).`;
                }

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
            const isActive = faqItem.classList.contains('faq-expanded');
            
            // Cerrar todas las FAQ primero para efecto acordeón exclusivo
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('faq-expanded');
            });
            
            // Si la FAQ cliqueada no estaba activa, la abrimos
            if (!isActive) {
                faqItem.classList.add('faq-expanded');
            }
        });
    });

    /* ==========================================================================
       9. OPINIONES VERIFICADAS E INTEGRACIÓN DE DETALLES DE VEHÍCULOS
       ========================================================================== */
    let detailCarouselIndex = 0;
    let detailCarouselImages = [];

    const openVanDetailsModal = (vanType) => {
        const van = databaseVans.find(v => v.van_type === vanType);
        if (!van) return;
        
        // Rellenar textos del modal
        document.getElementById('detail-van-name').textContent = van.name;
        document.getElementById('detail-van-m3').textContent = `${van.m3} de volumen`;
        document.getElementById('detail-van-price').innerHTML = `${parseFloat(van.price_sin).toFixed(2)}€<span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">/día</span>`;
        document.getElementById('detail-spec-plate').textContent = van.plate || '-';
        
        // Carrusel de imágenes
        const slidesContainer = document.getElementById('detail-carousel-slides');
        const dotsContainer = document.getElementById('detail-carousel-dots');
        slidesContainer.innerHTML = '';
        dotsContainer.innerHTML = '';
        
        let images = van.images;
        if (!Array.isArray(images) || images.length === 0) {
            images = [vanType === 'medium' ? 'assets/ford_transit.png' : 'assets/man_tge.png'];
        }
        
        detailCarouselImages = images;
        detailCarouselIndex = 0;
        
        images.forEach((img, idx) => {
            const slide = document.createElement('div');
            slide.style.minWidth = '100%';
            slide.style.height = '100%';
            slide.style.display = 'flex';
            slide.style.alignItems = 'center';
            slide.style.justifyContent = 'center';
            slide.innerHTML = `<img src="${img}" style="width: 100%; height: 100%; object-fit: cover;" alt="${van.name} foto ${idx + 1}">`;
            slidesContainer.appendChild(slide);
            
            const dot = document.createElement('span');
            dot.style.width = '10px';
            dot.style.height = '10px';
            dot.style.borderRadius = '50%';
            dot.style.background = idx === 0 ? 'var(--color-neon)' : 'rgba(255,255,255,0.3)';
            dot.style.cursor = 'pointer';
            dot.addEventListener('click', () => {
                showDetailCarouselSlide(idx);
            });
            dotsContainer.appendChild(dot);
        });
        
        // Mostrar modal
        window.openAuthModal('van-details-modal');
        showDetailCarouselSlide(0);
        
        // Configurar botón de reserva
        const bookBtn = document.getElementById('detail-van-book-btn');
        bookBtn.onclick = () => {
            vanSelect.value = vanType;
            vanSelect.dispatchEvent(new Event('change'));
            window.closeAuthModal('van-details-modal');
            
            const calcSection = document.getElementById('calculadora');
            if (calcSection) {
                calcSection.scrollIntoView({ behavior: 'smooth' });
            }
        };
    };
    
    const showDetailCarouselSlide = (idx) => {
        if (idx < 0) idx = detailCarouselImages.length - 1;
        if (idx >= detailCarouselImages.length) idx = 0;
        detailCarouselIndex = idx;
        
        const slidesContainer = document.getElementById('detail-carousel-slides');
        slidesContainer.style.transform = `translateX(-${idx * 100}%)`;
        
        const dots = document.querySelectorAll('#detail-carousel-dots span');
        dots.forEach((dot, dIdx) => {
            dot.style.background = dIdx === idx ? 'var(--color-neon)' : 'rgba(255,255,255,0.3)';
        });
    };
    
    document.getElementById('detail-carousel-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        showDetailCarouselSlide(detailCarouselIndex - 1);
    });
    document.getElementById('detail-carousel-next').addEventListener('click', (e) => {
        e.stopPropagation();
        showDetailCarouselSlide(detailCarouselIndex + 1);
    });

    // Abrir modal de detalles al hacer click en las tarjetas de furgonetas
    const vanCards = document.querySelectorAll('.van-card');
    vanCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', function(e) {
            const vanType = this.id.includes('large') ? 'large' : 'medium';
            openVanDetailsModal(vanType);
        });
    });

    let reviewsInterval;

    // Cargar opiniones de compras verificadas e inicializar el carrusel deslizante
    const loadReviews = async () => {
        try {
            const res = await fetch('/api/reviews');
            if (res.ok) {
                const reviews = await res.json();
                
                // Actualizar contador dinámico de reseñas
                const reviewsCountPlaceholder = document.getElementById('reviews-count-placeholder');
                if (reviewsCountPlaceholder) {
                    reviewsCountPlaceholder.textContent = reviews.length;
                }
                
                if (reviews.length > 0) {
                    testimonialsGrid.innerHTML = '';
                    
                    reviews.forEach(review => {
                        const rating = parseInt(review.rating) || 5;
                        const starsHtml = '<i class="fa-solid fa-star"></i>'.repeat(rating) + 
                                          '<i class="fa-regular fa-star" style="color: rgba(255,255,255,0.15);"></i>'.repeat(Math.max(0, 5 - rating));
                                          
                        const card = document.createElement('div');
                        card.className = 'testimonial-card';
                        card.style.flex = '0 0 100%';
                        card.style.boxSizing = 'border-box';
                        card.style.margin = '0';
                        card.innerHTML = `
                            <div class="stars">${starsHtml}</div>
                            <p class="testimonial-text">"${review.comment || 'Sin comentario.'}"</p>
                            <div class="testimonial-author">
                                <div class="author-info">
                                    <h4 class="author-name">${review.client_name}</h4>
                                    <p class="author-role">Particular (${review.role_or_city || 'Huéscar'})</p>
                                </div>
                            </div>
                            <div class="verified-badge" style="display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(130, 209, 5, 0.08); color: var(--color-neon); font-size: 0.75rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; margin-top: 1rem; border: 1px solid rgba(130, 209, 5, 0.2); align-self: flex-start;">
                                <i class="fa-solid fa-circle-check"></i> Compra Verificada
                            </div>
                        `;
                        testimonialsGrid.appendChild(card);
                    });
                    
                    // Inicializar controles del carrusel deslizante
                    initReviewsCarousel(reviews.length);
                }
            }
        } catch (err) {
            console.error('Error al cargar opiniones:', err);
        }
    };

    const initReviewsCarousel = (totalSlides) => {
        const track = document.getElementById('testimonials-grid');
        const prevBtn = document.getElementById('reviews-carousel-prev');
        const nextBtn = document.getElementById('reviews-carousel-next');
        const dotsContainer = document.getElementById('reviews-carousel-dots');
        
        if (!track || totalSlides <= 1) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (dotsContainer) dotsContainer.innerHTML = '';
            return;
        }
        
        if (prevBtn) prevBtn.style.display = 'flex';
        if (nextBtn) nextBtn.style.display = 'flex';
        
        let activeIdx = 0;
        
        // Generar puntitos indicadores del carrusel
        if (dotsContainer) {
            dotsContainer.innerHTML = '';
            for (let i = 0; i < totalSlides; i++) {
                const dot = document.createElement('span');
                dot.className = `reviews-carousel-dot${i === 0 ? ' active' : ''}`;
                dot.addEventListener('click', () => {
                    goToSlide(i);
                    resetAutoSlide();
                });
                dotsContainer.appendChild(dot);
            }
        }
        
        const updateCarouselPosition = () => {
            track.style.transform = `translateX(-${activeIdx * 100}%)`;
            if (dotsContainer) {
                Array.from(dotsContainer.children).forEach((dot, idx) => {
                    if (idx === activeIdx) {
                        dot.classList.add('active');
                    } else {
                        dot.classList.remove('active');
                    }
                });
            }
        };
        
        const goToSlide = (index) => {
            activeIdx = (index + totalSlides) % totalSlides;
            updateCarouselPosition();
        };
        
        if (prevBtn) {
            prevBtn.onclick = (e) => {
                e.preventDefault();
                goToSlide(activeIdx - 1);
                resetAutoSlide();
            };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.preventDefault();
                goToSlide(activeIdx + 1);
                resetAutoSlide();
            };
        }
        
        // Deslizamiento automático cada 6 segundos
        const startAutoSlide = () => {
            reviewsInterval = setInterval(() => {
                goToSlide(activeIdx + 1);
            }, 6000);
        };
        
        const resetAutoSlide = () => {
            if (reviewsInterval) clearInterval(reviewsInterval);
            startAutoSlide();
        };
        
        resetAutoSlide();
        
        // Pausa al hacer hover en el contenedor
        const container = track.closest('.testimonials-carousel-container');
        if (container) {
            container.onmouseenter = () => {
                if (reviewsInterval) clearInterval(reviewsInterval);
            };
            container.onmouseleave = () => {
                startAutoSlide();
            };
        }
    };

    // Escribir opinión verified
    if (btnOpenReviewModal) {
        btnOpenReviewModal.addEventListener('click', () => {
            window.openAuthModal('write-review-modal');
        });
    }

    // Inicializar selector de estrellas
    const initStarRating = () => {
        const stars = document.querySelectorAll('.star-rating-selector i');
        stars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                reviewRatingInput.value = rating;
                stars.forEach(s => {
                    const r = parseInt(s.getAttribute('data-rating'));
                    if (r <= rating) {
                        s.style.color = 'var(--color-neon)';
                    } else {
                        s.style.color = 'rgba(255,255,255,0.15)';
                    }
                });
            });
            
            star.addEventListener('mouseenter', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                stars.forEach(s => {
                    const r = parseInt(s.getAttribute('data-rating'));
                    if (r <= rating) {
                        s.style.color = 'var(--color-neon)';
                    } else {
                        s.style.color = 'rgba(255,255,255,0.15)';
                    }
                });
            });
        });
        
        const selector = document.querySelector('.star-rating-selector');
        if (selector) {
            selector.addEventListener('mouseleave', () => {
                const rating = parseInt(reviewRatingInput.value);
                stars.forEach(s => {
                    const r = parseInt(s.getAttribute('data-rating'));
                    if (r <= rating) {
                        s.style.color = 'var(--color-neon)';
                    } else {
                        s.style.color = 'rgba(255,255,255,0.15)';
                    }
                });
            });
        }
    };

    if (writeReviewForm) {
        writeReviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = writeReviewForm.querySelector('button[type="submit"]');
            const originalHtml = submitBtn.innerHTML;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Publicando reseña...';
            
            try {
                const res = await fetch('/api/reviews', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        booking_code: reviewCodeInput.value.trim(),
                        client_name: reviewNameInput.value.trim(),
                        rating: parseInt(reviewRatingInput.value),
                        comment: reviewCommentInput.value.trim() || "",
                        role_or_city: reviewCityInput.value.trim()
                    })
                });
                
                const data = await res.json();
                if (res.ok) {
                    alert('¡Gracias por tu opinión! Tu reseña verificada ha sido publicada correctamente.');
                    window.closeAuthModal('write-review-modal');
                    writeReviewForm.reset();
                    reviewRatingInput.value = '5';
                    document.querySelectorAll('.star-rating-selector i').forEach((s) => {
                        s.style.color = 'var(--color-neon)';
                    });
                    loadReviews();
                } else {
                    alert(data.error || 'Error al publicar opinión.');
                }
            } catch (err) {
                console.error(err);
                alert('Error de conexión con el servidor.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalHtml;
            }
        });
    }

    // Cargar configuraciones de horario y de visualización del badge de opiniones
    const loadSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                const week = document.getElementById('hours-weekdays');
                const sat = document.getElementById('hours-saturdays');
                const sun = document.getElementById('hours-sundays');
                
                if (week && data.hours_weekdays) week.textContent = data.hours_weekdays;
                if (sat && data.hours_saturdays) sat.textContent = data.hours_saturdays;
                if (sun && data.hours_sundays) sun.textContent = data.hours_sundays;
                
                // Mostrar/ocultar placa de cantidad de opiniones verificadas
                const badge = document.getElementById('reviews-count-badge');
                if (badge) {
                    if (data.show_reviews_count === 'true') {
                        badge.style.display = 'inline-flex';
                    } else {
                        badge.style.display = 'none';
                    }
                }
            }
        } catch (err) {
            console.error('Error al cargar horarios:', err);
        }
    };

    // Formulario de Contacto directo a WhatsApp
    const contactForm = document.getElementById('contact-whatsapp-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('contact-form-name').value.trim();
            const contact = document.getElementById('contact-form-phone').value.trim();
            const reason = document.getElementById('contact-form-reason').value;
            const message = document.getElementById('contact-form-message').value.trim();
            
            const text = `Hola RentMeUskar, me llamo *${name}*.\n\n*Contacto:* ${contact}\n*Motivo:* ${reason}\n\n*Mensaje:*\n${message}`;
            const encodedText = encodeURIComponent(text);
            const whatsappUrl = `https://wa.me/34614767411?text=${encodedText}`;
            
            window.open(whatsappUrl, '_blank');
            contactForm.reset();
        });
    }

    // Ejecutar inicializaciones dinámicas
    loadReviews();
    loadSettings();
    initStarRating();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
