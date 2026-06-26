// api/conta-fixa-delete.js
// DELETE /api/conta-fixa-delete
// Remove uma conta fixa da aba "Contas_Fixas" pelo campo `id`.

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
        const sheet = doc.sheetsByTitle['Contas_Fixas'];
        if (!sheet) throw new Error('Aba "Contas_Fixas" não encontrada.');

        const rows = await sheet.getRows();
        const row = rows.find(r => parseInt(r.get('id'), 10) === id);

        if (!row) {
            return res.status(404).json({ ok: false, error: `Conta fixa #${id} não encontrada.` });
        }

        await row.delete();
        return res.status(200).json({ ok: true, message: `Conta fixa #${id} excluída com sucesso.` });
    } catch (err) {
        console.error('Erro em /api/conta-fixa-delete:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao excluir conta fixa.' });
    }
};
