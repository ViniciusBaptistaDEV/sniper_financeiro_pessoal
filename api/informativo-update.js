// api/informativo-update.js
// PUT /api/informativo-update
// Atualiza um informativo na aba "Informativos" pelo campo `id`.

const { getDoc, setCors, toInt } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    setCors(res);
    res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'PUT') {
        return res.status(405).json({ ok: false, error: 'Método não permitido. Use PUT.' });
    }

    try {
        const body = req.body || {};
        const id = parseInt(body.id, 10);

        if (!id || isNaN(id)) {
            return res.status(400).json({ ok: false, error: 'Campo "id" é obrigatório.' });
        }

        const doc = await getDoc();
        const sheet = doc.sheetsByTitle['Informativos'];
        if (!sheet) throw new Error('Aba "Informativos" não encontrada.');

        const allRows = await sheet.getRows();
        const row = allRows.find(r => parseInt(r.get('id'), 10) === id);

        if (!row) {
            return res.status(404).json({ ok: false, error: `Informativo #${id} não encontrado.` });
        }

        if (body.servico !== undefined) row.set('servico', body.servico);
        if (body.dia_cobranca !== undefined) row.set('dia_cobranca', toInt(body.dia_cobranca));
        if (body.cartao_destino !== undefined) row.set('cartao_destino', body.cartao_destino);
        if (body.modalidade !== undefined) row.set('modalidade', body.modalidade);
        if (body.observacao !== undefined) row.set('observacao', body.observacao);

        await row.save();
        return res.status(200).json({ ok: true, message: `Informativo #${id} atualizado com sucesso.` });
    } catch (err) {
        console.error('Erro em /api/informativo-update:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao atualizar informativo.' });
    }
};
