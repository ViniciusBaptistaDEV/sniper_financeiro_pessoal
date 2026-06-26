// api/conta-fixa-update.js
// PUT /api/conta-fixa-update
// Atualiza uma conta fixa na aba "Contas_Fixas" pelo campo `id`.

const { getDoc, setCors, toNumber, toInt } = require('./sheets-helper');

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
        const sheet = doc.sheetsByTitle['Contas_Fixas'];
        if (!sheet) throw new Error('Aba "Contas_Fixas" não encontrada.');

        const allRows = await sheet.getRows();
        const row = allRows.find(r => parseInt(r.get('id'), 10) === id);

        if (!row) {
            return res.status(404).json({ ok: false, error: `Conta fixa #${id} não encontrada.` });
        }

        if (body.descricao !== undefined) row.set('descricao', body.descricao);
        if (body.valor_estimado !== undefined) row.set('valor_estimado', toNumber(body.valor_estimado));
        if (body.tipo !== undefined) row.set('tipo', body.tipo);
        if (body.total_parcelas !== undefined) row.set('total_parcelas', toInt(body.total_parcelas));
        if (body.dia_vencimento !== undefined) row.set('dia_vencimento', toInt(body.dia_vencimento));
        if (body.observacao !== undefined) row.set('observacao', body.observacao);

        await row.save();
        return res.status(200).json({ ok: true, message: `Conta fixa #${id} atualizada com sucesso.` });
    } catch (err) {
        console.error('Erro em /api/conta-fixa-update:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao atualizar conta fixa.' });
    }
};
