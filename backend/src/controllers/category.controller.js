import * as categoryService from '../services/category.service.js';

export async function listCategories(req, res) {
    const categories = await categoryService.listCategories();
    res.json({ categories });
}
