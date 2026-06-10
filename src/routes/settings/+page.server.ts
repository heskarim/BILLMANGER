import { getSettings, updateSettings } from '$lib/server/db';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  const settings = getSettings();
  return {
    settings
  };
};

export const actions: Actions = {
  saveSettings: async ({ request }) => {
    const data = await request.formData();
    const company_name = data.get('company_name') as string;
    const address = data.get('address') as string;
    const phone = data.get('phone') as string;
    const email = data.get('email') as string;
    const rc = data.get('rc') as string;
    const art = data.get('art') as string;
    const nif = data.get('nif') as string;
    const nis = data.get('nis') as string;
    const rib = data.get('rib') as string;
    const logo = data.get('logo') as string; // Will store base64 data URL

    // Core validation
    if (!company_name || !address || !phone) {
      return fail(400, { 
        error: 'Company Name, Address, and Phone number are required.',
        values: { company_name, address, phone, email, rc, art, nif, nis, rib }
      });
    }

    try {
      updateSettings({
        company_name,
        address,
        phone,
        email,
        rc,
        art,
        nif,
        nis,
        rib,
        logo: logo || ''
      });
      return { success: true };
    } catch (err: any) {
      console.error('Database update error:', err);
      return fail(500, { 
        error: `Failed to save settings: ${err.message}`,
        values: { company_name, address, phone, email, rc, art, nif, nis, rib }
      });
    }
  }
};
