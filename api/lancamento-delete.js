// api/lancamento-delete.js
// DELETE /api/lancamento-delete
// Remove um lançamento da aba "Lancamentos" pelo campo `id`.
// Body esperado: { id: Number }

const { getDoc, setCors } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'DELETE') {
        return res.status(405).json({ ok: false, error: 'Método não permitido. Use DELETE.' });
    }

    try {
        const body = req.body || {};
        const id = parseInt(body.id, 10);

        if (!id || isNaN(id)) {
            return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });
        }

        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Lancamentos'];
        if (!sheet) throw new Error('Aba "Lancamentos" não encontrada.');

        const rows = await sheet.getRows();
        const row = rows.find(r => parseInt(r.get('id'), 10) === id);

        if (!row) {
            return res.status(404).json({ ok: false, error: `Lançamento #${id} não encontrado.` });
        }

        await row.delete();
        return res.status(200).json({ ok: true, message: `Lançamento #${id} excluído com sucesso.` });
    } catch (err) {
        console.error('Erro em /api/lancamento-delete:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao excluir lançamento.' });
    }
};
