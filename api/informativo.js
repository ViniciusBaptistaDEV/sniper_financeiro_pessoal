// api/informativo.js
// POST /api/informativo
// Grava um informativo na aba "Informativos".
// Body esperado: { servico, dia_cobranca, cartao_destino, modalidade,
//                   observacao }

const { addSheetRow, toInt, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'POST')) return;

    try {
        const body = req.body || {};

        if (!body.servico || !body.dia_cobranca) {
            return res.status(400).json({
                ok: false,
                error: 'Campos "servico" e "dia_cobranca" são obrigatórios.',
            });
        }

        const row = {
            servico: body.servico,
            dia_cobranca: toInt(body.dia_cobranca),
            cartao_destino: body.cartao_destino || '',
            modalidade: body.modalidade || 'Mensal',
            observacao: body.observacao || '',
        };

        const result = await addSheetRow('Informativos', row);
        return res.status(200).json({ ok: true, id: result.id, row: result.row });
    } catch (err) {
        console.error('Erro em /api/informativo:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao salvar informativo.' });
    }
};
