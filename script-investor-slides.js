// script-investor-slides.js
'use strict';

document.addEventListener('DOMContentLoaded', () => {
    // --- Opcional: Splitting.js para animación de caracteres ---
    // Primero, verifica si Splitting está definido (cargado desde CDN)
    const titlesToSplit = document.querySelectorAll('[data-splitting]');
    if (titlesToSplit.length > 0) {
        if (typeof Splitting === 'function') {
            try {
                Splitting({ target: '[data-splitting]', by: 'chars' });
                console.log('Splitting.js aplicado.');
            } catch (e) {
                console.error('Error al aplicar Splitting.js:', e);
            }
        } else {
            console.warn('Splitting.js no está cargado, pero hay elementos con data-splitting. Las animaciones de caracteres individuales no funcionarán.');
        }
    }

    // --- Selección de Elementos del DOM ---
    const slides = document.querySelectorAll('.deck-slide');
    const nextButton = document.getElementById('next-slide');
    const prevButton = document.getElementById('prev-slide');
    const slideIndicator = document.getElementById('current-slide-indicator');
    const firstSlideCTA = document.querySelector('#portada .next-slide-button');
    const slideNavigationContainer = document.querySelector('.deck-slide-navigation');

    if (!slides.length || !nextButton || !prevButton || !slideIndicator || !slideNavigationContainer) {
        console.error('Error: No se encontraron todos los elementos necesarios para la presentación.');
        return;
    }

    let currentSlide = 0;
    const totalSlides = slides.length;
    let animating = false; // Flag para prevenir múltiples transiciones rápidas

    // --- Configuración de Animaciones GSAP ---
    const animateSlideIn = (slideElement) => {
        if (!slideElement) return;

        const tl = gsap.timeline({
            defaults: {
                duration: 0.65,
                ease: 'power2.out'
            }
        });

        // Resetear elementos antes de animar para que la animación se repita si se vuelve a la slide
        gsap.set(slideElement.querySelectorAll('.animated-title-line, .animated-subtitle, .animated-text-block, .animated-list > *, .animated-list-ordered > *, .animated-list-bullet > *, .animated-grid > *, .animated-data, .animated-stat, .deck-scroll-prompt, .slide-nav-button'), { opacity: 0, y: 25, x:0, scale:1 });
        gsap.set(slideElement.querySelectorAll('.deck-main-title .char, .deck-slide-title[data-splitting] .char'), { opacity: 0, y: 35 });
        gsap.set(slideElement.querySelector('.deck-slide-title::before'), { scaleX: 0 }); // Para la línea del título

        // Animación del título principal de la diapositiva
        const title = slideElement.querySelector('.deck-main-title[data-splitting], .deck-slide-title[data-splitting]');
        const blockTitle = slideElement.querySelector('.deck-slide-title:not([data-splitting])');

        let titleAnimationDelay = 0.3; // Delay para que el contenido aparezca después de la transición de slide

        if (title && title.querySelectorAll('.char').length > 0) {
            tl.from(title.querySelectorAll('.char'), { opacity: 0, y: 35, stagger: 0.03, duration: 0.6 }, titleAnimationDelay);
        } else if (blockTitle) {
            tl.from(blockTitle, { opacity: 0, y: 35, duration: 0.7 }, titleAnimationDelay);
        } else {
            titleAnimationDelay = 0; // Si no hay título, el resto empieza antes
        }
        
        // Animación de la línea bajo el título (CSS debe tener transition también para ::before)
        const titleLineElement = slideElement.querySelector('.deck-slide-title.animated-title-line');
        if(titleLineElement) {
            // GSAP no anima pseudo-elementos directamente. Usamos una clase.
            // La clase 'animate-line' debe tener en CSS: .deck-slide.active-slide .deck-slide-title.animate-line::before { transform: scaleX(1); }
            // Y la transición definida en .deck-slide-title::before
            tl.call(() => titleLineElement.classList.add('animate-line'), [], (title || blockTitle) ? "-=0.4" : titleAnimationDelay + 0.1);
        }


        // Animación de otros elementos de contenido
        tl.from(slideElement.querySelectorAll('.animated-subtitle, .deck-tagline'), { opacity: 0, y: 20, duration: 0.7 }, (title || blockTitle) ? "-=0.4" : titleAnimationDelay + 0.2)
          .from(slideElement.querySelectorAll('.animated-text-block, .deck-p, .deck-stat-highlight, .deck-value-prop-highlight, .deck-contact-p, .deck-contact-info, .disclaimer-text, .deck-scroll-prompt, .slide-nav-button:not(#prev-slide):not(#next-slide)'), {
                opacity: 0,
                y: 20,
                stagger: 0.12,
                duration: 0.55
            }, "-=0.3")
          .from(slideElement.querySelectorAll('.animated-list > *, .animated-list-ordered > *, .animated-list-bullet > *'), {
                opacity: 0,
                x: -20,
                stagger: 0.08,
                duration: 0.45
            }, "-=0.3")
          .from(slideElement.querySelectorAll('.animated-grid > *'), {
                opacity: 0,
                scale: 0.97,
                stagger: 0.08,
                duration: 0.45
            }, "-=0.3");

        // Animación de contador para valores numéricos
        slideElement.querySelectorAll('.projection-value[data-count-to]').forEach(valueEl => {
            const endValue = parseFloat(valueEl.dataset.countTo);
            const suffix = valueEl.dataset.suffix || "";
            let obj = { val: 0 };
            tl.to(obj, {
                val: endValue,
                duration: 1.1, // Ligeramente más largo para que se aprecie
                ease: 'power1.out',
                snap: { val: (endValue % 1 !== 0 ? 0.1 : 1) },
                onUpdate: () => {
                    valueEl.textContent = (endValue % 1 !== 0 ? obj.val.toFixed(1) : Math.round(obj.val)) + suffix;
                },
                onStart: () => { // Resetear el texto antes de animar
                    valueEl.textContent = (endValue % 1 !== 0 ? (0).toFixed(1) : 0) + suffix;
                }
            }, "-=0.6"); // Sincronizar
        });

        // Animación para .highlight-stat-value si tiene data-value-text
        slideElement.querySelectorAll('.highlight-stat-value[data-value-text]').forEach(el => {
            const text = el.dataset.valueText;
            tl.fromTo(el, { opacity: 0, y:10 }, {
                opacity: 1, y:0, duration: 0.6, 
                onStart: () => el.textContent = text
            }, "-=0.5"); // Sincronizar
        });
    };

    const goToSlide = (slideIndex, direction = 'next') => {
        if (slideIndex < 0 || slideIndex >= totalSlides || animating) return;
        animating = true;

        const currentActiveSlide = slides[currentSlide];
        const newActiveSlide = slides[slideIndex];

        // Limpiar animaciones previas de elementos internos de la slide que va a salir
        if (currentActiveSlide.querySelector('.deck-slide-title.animate-line')) {
            currentActiveSlide.querySelector('.deck-slide-title.animate-line').classList.remove('animate-line');
        }

        // Transición de Diapositivas
        gsap.timeline({
            onComplete: () => {
                currentActiveSlide.classList.remove('active-slide', 'exit-left', 'exit-right');
                currentActiveSlide.style.transform = ''; // Reset
                
                newActiveSlide.classList.add('active-slide');
                newActiveSlide.classList.remove('exit-left', 'exit-right'); // Limpiar si se usó para entrada
                
                animateSlideIn(newActiveSlide); // Animar contenido de la nueva slide
                animating = false;
            }
        })
        .to(currentActiveSlide, {
            x: direction === 'next' ? '-100%' : '100%',
            opacity: 0,
            duration: varGet('--slide-transition-duration', 0.7), // Usa variable CSS
            ease: varGet('--slide-transition-ease', 'cubic-bezier(0.645, 0.045, 0.355, 1)')
        })
        .fromTo(newActiveSlide, 
            { x: direction === 'next' ? '100%' : '-100%', opacity: 0, visibility: 'visible' }, // Asegurar visibilidad
            { x: '0%', opacity: 1, duration: varGet('--slide-transition-duration', 0.7), ease: varGet('--slide-transition-ease', 'cubic-bezier(0.645, 0.045, 0.355, 1)') }
        , "<"); // Iniciar al mismo tiempo que la salida

        currentSlide = slideIndex;
        updateNavigation();
    };
    
    // Helper para obtener valor de variable CSS o un default
    function varGet(varName, defaultValue) {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName.startsWith('--') ? varName : `--${varName}`).trim();
        return value || (typeof defaultValue === 'number' ? `${defaultValue}s` : defaultValue);
    }


    const updateNavigation = () => {
        slideIndicator.textContent = `${currentSlide + 1} / ${totalSlides}`;
        prevButton.disabled = currentSlide === 0;
        nextButton.disabled = currentSlide === totalSlides - 1;

        // Tema oscuro para la navegación inferior
        if (slides[currentSlide].classList.contains('dark-theme')) {
            slideNavigationContainer.classList.add('dark-theme-navigation');
        } else {
            slideNavigationContainer.classList.remove('dark-theme-navigation');
        }
    };

    // --- Event Listeners para Navegación ---
    nextButton.addEventListener('click', () => goToSlide(currentSlide + 1, 'next'));
    prevButton.addEventListener('click', () => goToSlide(currentSlide - 1, 'prev'));

    if (firstSlideCTA) {
        firstSlideCTA.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = firstSlideCTA.dataset.targetId; // Asegúrate que tu HTML tenga data-target-id
            const targetIndex = Array.from(slides).findIndex(s => s.id === targetId);
            if (targetIndex !== -1) {
                goToSlide(targetIndex, 'next');
            }
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' /* Barra espaciadora */) {
            if(currentSlide < totalSlides - 1 && !nextButton.disabled) {
                e.preventDefault(); // Evitar scroll de página si la barra espaciadora se usa
                goToSlide(currentSlide + 1, 'next');
            }
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
             if(currentSlide > 0 && !prevButton.disabled) {
                e.preventDefault();
                goToSlide(currentSlide - 1, 'prev');
             }
        } else if (e.key === 'Home') {
            e.preventDefault();
            goToSlide(0, 'prev');
        } else if (e.key === 'End') {
            e.preventDefault();
            goToSlide(totalSlides - 1, 'next');
        }
    });


    // --- Inicialización de la Primera Diapositiva ---
    const initialSlide = document.querySelector('.deck-slide.active-slide');
    if (initialSlide) {
        // Asegurar que la primera slide esté visible y en posición para su animación de entrada
        gsap.set(initialSlide, { x: '0%', opacity: 1, visibility: 'visible' });
        animateSlideIn(initialSlide); // Animar contenido de la primera slide
    } else if (slides.length > 0) { // Si ninguna es activa, activa la primera
        slides[0].classList.add('active-slide');
        gsap.set(slides[0], { x: '0%', opacity: 1, visibility: 'visible' });
        animateSlideIn(slides[0]);
    }
    updateNavigation();

    console.log('Investor Deck Slides Initialized.');
});
