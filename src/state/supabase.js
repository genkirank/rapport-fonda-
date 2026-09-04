/**
 * Central Supabase Client & Authentication Helper
 */

const SUPABASE_URL = 'https://njunspsbrwiyvegrqqpm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW5zcHNicndpeXZlZ3JxcXBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5MTM2NjQsImV4cCI6MjEwMzQ4OTY2NH0.QPgxTFO7rV_3G98hx8zXiss9gi6P13eYi1WMsQs-gHI';

export class SupabaseService {
    constructor() {
        this.client = (typeof window !== 'undefined' && window.supabase)
            ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
            : null;
        this.currentUser = null;
        this.session = null;
    }

    getClient() {
        if (!this.client && typeof window !== 'undefined' && window.supabase) {
            this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }
        return this.client;
    }

    async init() {
        const client = this.getClient();
        if (!client) return null;

        try {
            const { data, error } = await client.auth.getSession();
            if (error) throw error;
            this.session = data?.session || null;
            this.currentUser = data?.session?.user || null;
            return this.currentUser;
        } catch (e) {
            console.warn('Supabase session init warning:', e.message);
            return null;
        }
    }

    async signIn(email, password) {
        const client = this.getClient();
        if (!client) throw new Error('Supabase client indisponible.');

        const { data, error } = await client.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;

        this.session = data.session;
        this.currentUser = data.user;
        return data;
    }

    async signUp(email, password) {
        const client = this.getClient();
        if (!client) throw new Error('Supabase client indisponible.');

        const { data, error } = await client.auth.signUp({
            email,
            password
        });
        if (error) throw error;

        this.session = data.session;
        this.currentUser = data.user;
        return data;
    }

    async signOut() {
        const client = this.getClient();
        if (client) {
            try {
                await client.auth.signOut();
            } catch (e) {
                console.error(e);
            }
        }
        this.session = null;
        this.currentUser = null;
    }

    getUser() {
        return this.currentUser;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }
}

export const supabaseService = new SupabaseService();
