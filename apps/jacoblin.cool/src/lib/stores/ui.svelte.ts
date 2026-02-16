import { browser } from '$app/environment';

export type UiState = {
    isSidebarOpenDesktop: boolean;
    isSidebarOpenMobile: boolean;
    isUserMenuOpen: boolean;
    isLoginModalOpen: boolean;
    accountMenuPresentation: 'popover' | 'sheet';
};

class UiStore {
    static instance: UiStore | null = null;
    state = $state<UiState>({
        isSidebarOpenDesktop: false,
        isSidebarOpenMobile: false,
        isUserMenuOpen: false,
        isLoginModalOpen: false,
        accountMenuPresentation: 'popover'
    });

    static getInstance() {
        UiStore.instance ??= new UiStore();
        return UiStore.instance;
    }

    toggleDesktopSidebar() {
        this.state.isSidebarOpenDesktop = !this.state.isSidebarOpenDesktop;
    }

    openMobileSidebar() {
        this.state.isSidebarOpenMobile = true;
    }

    closeMobileSidebar() {
        this.state.isSidebarOpenMobile = false;
    }

    toggleMobileSidebar() {
        this.state.isSidebarOpenMobile = !this.state.isSidebarOpenMobile;
    }

    toggleSidebarForViewport() {
        if (!browser) {
            this.toggleDesktopSidebar();
            return;
        }

        if (window.matchMedia('(max-width: 1023px)').matches) {
            this.toggleMobileSidebar();
            return;
        }

        this.toggleDesktopSidebar();
    }

    syncAccountMenuPresentation() {
        if (!browser) {
            this.state.accountMenuPresentation = 'popover';
            return;
        }

        const prefersSheet =
            window.matchMedia('(max-width: 768px)').matches ||
            window.matchMedia('(pointer: coarse)').matches;
        this.state.accountMenuPresentation = prefersSheet ? 'sheet' : 'popover';
    }

    openUserMenu() {
        this.state.isUserMenuOpen = true;
    }

    closeUserMenu() {
        this.state.isUserMenuOpen = false;
    }

    toggleUserMenu() {
        this.state.isUserMenuOpen = !this.state.isUserMenuOpen;
    }

    openLoginModal() {
        this.state.isLoginModalOpen = true;
    }

    closeLoginModal() {
        this.state.isLoginModalOpen = false;
    }

    closeTransientUi() {
        this.closeUserMenu();
        this.closeMobileSidebar();
    }
}

export const uiStore = UiStore.getInstance();
