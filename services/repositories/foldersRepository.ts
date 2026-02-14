import { supabase } from '../supabase';

export const createFolderRecord = async (folderId: string, userId: string, name: string) => {
    return supabase
        .from('folders')
        .insert({ id: folderId, user_id: userId, name });
};

export const deleteFolderRecord = async (folderId: string) => {
    return supabase
        .from('folders')
        .delete()
        .eq('id', folderId);
};

