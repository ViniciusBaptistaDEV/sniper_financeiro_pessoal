// api/gasto-diario.js
// POST /api/gasto-diario
// Grava um gasto diário na aba "Lancamentos" com tipo="gasto_diario".
// Body esperado: { descricao, valor, data_realizado, data_competencia,
//                   forma_pagamento, observacao }

const { addSheetRow, toNumber, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'POST')) return;

    try {
        const body = req.body || {};

        if (!body.descricao || !body.valor) {
            return res.status(400).json({
                ok: false,
                error: 'Campos "descricao" e "valor" são obrigatórios.',
            });
        }

        const dataRealizado = body.data_realizado || new Date().toISOString().slice(0, 10);
        const row = {
            data_competencia: body.data_competencia || dataRealizado.slice(0, 7),
            data_realizado: dataRealizado,
            tipo: 'gasto_diario',
            conta_fixa_id: '',
            descricao: body.descricao,
            valor: toNumber(body.valor),
            forma_pagamento: body.forma_pagamento || '',
            tipo_pagamento: body.tipo_pagamento || '',
            parcelas: body.parcelas || '',
            observacao: body.observacao || '',
        };

        const result = await addSheetRow('Lancamentos', row);
        return res.status(200).json({ ok: true, id: result.id, row: result.row });
    } catch (err) {
        console.error('Erro em /api/gasto-diario:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao salvar gasto.' });
    }
};
