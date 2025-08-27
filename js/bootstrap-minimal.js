// Minimal Bootstrap JS replacements for popup
class BootstrapModal {
    constructor(element) {
        this.element = element;
    }
    
    show() {
        this.element.classList.add('show');
        this.element.style.display = 'block';
        document.body.classList.add('modal-open');
    }
    
    hide() {
        this.element.classList.remove('show');
        this.element.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
    
    static getInstance(element) {
        return new BootstrapModal(element);
    }
}

class BootstrapToast {
    constructor(element) {
        this.element = element;
    }
    
    show() {
        this.element.classList.add('show');
        setTimeout(() => {
            this.hide();
        }, 3000);
    }
    
    hide() {
        this.element.classList.remove('show');
    }
    
    static getInstance(element) {
        return new BootstrapToast(element);
    }
}

// Global Bootstrap object for compatibility
window.bootstrap = {
    Modal: BootstrapModal,
    Toast: BootstrapToast
};

// Initialize modal close functionality
document.addEventListener('DOMContentLoaded', () => {
    // Handle modal close buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close') || 
            e.target.getAttribute('data-bs-dismiss') === 'modal') {
            const modal = e.target.closest('.modal');
            if (modal) {
                const modalInstance = new BootstrapModal(modal);
                modalInstance.hide();
            }
        }
    });
    
    // Handle modal backdrop clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            const modalInstance = new BootstrapModal(e.target);
            modalInstance.hide();
        }
    });
});