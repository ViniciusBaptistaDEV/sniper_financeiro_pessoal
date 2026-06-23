// api/lancamento-update.js
// PUT /api/lancamento-update
// Atualiza um lançamento existente na aba "Lancamentos" pelo campo `id`.
// Body esperado: { id, descricao, valor, data_realizado, data_competencia, forma_pagamento, observacao }

const { getDoc, setCors, toNumber } = require('./sheets-helper');

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
        const sheet = doc.sheetsByTitle['Lancamentos'];
        if (!sheet) throw new Error('Aba "Lancamentos" não encontrada.');

        const rows = await sheet.getRows();
        const row = rows.find(r => parseInt(r.get('id'), 10) === id);

        if (!row) {
            return res.status(404).json({ ok: false, error: `Lançamento #${id} não encontrado.` });
        }

        // Atualiza apenas os campos permitidos (nunca altera tipo/conta_fixa_id/id)
        if (body.descricao !== undefined) row.set('descricao', body.descricao);
        if (body.valor !== undefined)     row.set('valor', toNumber(body.valor));
        if (body.data_realizado !== undefined)   row.set('data_realizado', body.data_realizado);
        if (body.data_competencia !== undefined) row.set('data_competencia', body.data_competencia);
        if (body.forma_pagamento !== undefined)  row.set('forma_pagamento', body.forma_pagamento);
        if (body.observacao !== undefined)       row.set('observacao', body.observacao);

        await row.save();
        return res.status(200).json({ ok: true, message: `Lançamento #${id} atualizado com sucesso.` });
    } catch (err) {
        console.error('Erro em /api/lancamento-update:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao atualizar lançamento.' });
    }
};
