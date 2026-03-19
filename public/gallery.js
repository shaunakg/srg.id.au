/**
 * Gallery Lightbox Component
 * Provides lightbox functionality for gallery items (images and videos)
 */

(function() {
    'use strict';

    // Prevent multiple initializations
    if (window.galleryLightboxInitialized) return;
    window.galleryLightboxInitialized = true;

    // State
    let currentGallery = null;
    let currentIndex = 0;
    let items = [];

    // Get all galleries on the page
    function initGalleries() {
        const galleries = document.querySelectorAll('.gallery');
        
        galleries.forEach(gallery => {
            const galleryItems = gallery.querySelectorAll('.gallery-item');
            const lightbox = gallery.querySelector('.gallery-lightbox');
            
            if (!lightbox || galleryItems.length === 0) return;

            // Store lightbox reference on gallery
            gallery._lightbox = lightbox;
            gallery._items = Array.from(galleryItems);

            // Add click handlers to gallery items
            galleryItems.forEach((item, index) => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    openLightbox(gallery, index);
                });

                // Make items keyboard accessible
                item.setAttribute('tabindex', '0');
                item.setAttribute('role', 'button');
                item.setAttribute('aria-label', `View ${item.dataset.type || 'image'} ${index + 1} of ${galleryItems.length}`);
                
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLightbox(gallery, index);
                    }
                });
            });

            // Setup lightbox controls
            setupLightboxControls(lightbox);
        });
    }

    function setupLightboxControls(lightbox) {
        const closeBtn = lightbox.querySelector('.gallery-lightbox-close');
        const prevBtn = lightbox.querySelector('.gallery-lightbox-prev');
        const nextBtn = lightbox.querySelector('.gallery-lightbox-next');

        closeBtn?.addEventListener('click', closeLightbox);
        prevBtn?.addEventListener('click', () => navigate(-1));
        nextBtn?.addEventListener('click', () => navigate(1));

        // Close on backdrop click
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });
    }

    function openLightbox(gallery, index) {
        currentGallery = gallery;
        items = gallery._items;
        currentIndex = index;

        const lightbox = gallery._lightbox;
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        // Focus trap
        lightbox.focus();

        // Add keyboard listeners
        document.addEventListener('keydown', handleKeydown);

        updateLightboxContent();
    }

    function closeLightbox() {
        if (!currentGallery) return;

        const lightbox = currentGallery._lightbox;
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';

        // Stop any playing videos
        const video = lightbox.querySelector('.gallery-lightbox-content video');
        if (video) {
            video.pause();
        }

        // Remove keyboard listeners
        document.removeEventListener('keydown', handleKeydown);

        // Return focus to the clicked item
        items[currentIndex]?.focus();

        currentGallery = null;
        items = [];
        currentIndex = 0;
    }

    function navigate(direction) {
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < items.length) {
            currentIndex = newIndex;
            updateLightboxContent();
        }
    }

    function updateLightboxContent() {
        if (!currentGallery) return;

        const lightbox = currentGallery._lightbox;
        const contentEl = lightbox.querySelector('.gallery-lightbox-content');
        const captionEl = lightbox.querySelector('.gallery-lightbox-caption');
        const counterEl = lightbox.querySelector('.gallery-lightbox-counter');
        const prevBtn = lightbox.querySelector('.gallery-lightbox-prev');
        const nextBtn = lightbox.querySelector('.gallery-lightbox-next');

        const item = items[currentIndex];
        const type = item.dataset.type || 'image';
        const img = item.querySelector('img');
        const video = item.querySelector('video');
        const caption = item.querySelector('figcaption');

        // Stop any currently playing videos
        const currentVideo = contentEl.querySelector('video');
        if (currentVideo) {
            currentVideo.pause();
        }

        // Update content
        if (type === 'video' && video) {
            const videoSrc = video.querySelector('source')?.src || video.src;
            contentEl.innerHTML = `
                <video controls autoplay>
                    <source src="${videoSrc}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        } else if (img) {
            contentEl.innerHTML = `<img src="${img.src}" alt="${img.alt || ''}">`;
        }

        // Update caption
        captionEl.innerHTML = caption ? caption.innerHTML : '';

        // Update counter
        counterEl.textContent = `${currentIndex + 1} / ${items.length}`;

        // Update navigation buttons
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === items.length - 1;

        // Hide nav buttons if only one item
        if (items.length <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            counterEl.style.display = 'none';
        } else {
            prevBtn.style.display = '';
            nextBtn.style.display = '';
            counterEl.style.display = '';
        }
    }

    function handleKeydown(e) {
        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                navigate(-1);
                break;
            case 'ArrowRight':
                navigate(1);
                break;
        }
    }

    // Touch/swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    document.addEventListener('touchstart', (e) => {
        if (!currentGallery) return;
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!currentGallery) return;
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    }, { passive: true });

    function handleSwipe() {
        const swipeThreshold = 50;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Swiped left - go next
                navigate(1);
            } else {
                // Swiped right - go previous
                navigate(-1);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGalleries);
    } else {
        initGalleries();
    }
})();
