// api/nova-conta-fixa.js
// POST /api/nova-conta-fixa
// Cadastra uma nova conta fixa na aba "Contas_Fixas".
// Body esperado: { descricao, valor_estimado, tipo, total_parcelas,
//                   dia_vencimento, observacao }
//   - tipo: "infinita" (recorrente) ou "parcelada"
//   - total_parcelas: obrigatório se tipo="parcelada"

const { addSheetRow, toNumber, toInt, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'POST')) return;

    try {
        const body = req.body || {};

        if (!body.descricao || !body.valor_estimado || !body.dia_vencimento) {
            return res.status(400).json({
                ok: false,
                error: 'Campos "descricao", "valor_estimado" e "dia_vencimento" são obrigatórios.',
            });
        }

        if (body.tipo === 'parcelada' && !body.total_parcelas) {
            return res.status(400).json({
                ok: false,
                error: 'Para conta fixa parcelada, informe "total_parcelas".',
            });
        }

        const row = {
            descricao: body.descricao,
            valor_estimado: toNumber(body.valor_estimado),
            tipo: body.tipo || 'infinita',
            total_parcelas: toInt(body.total_parcelas),
            dia_vencimento: toInt(body.dia_vencimento),
            observacao: body.observacao || '',
        };

        const result = await addSheetRow('Contas_Fixas', row);
        return res.status(200).json({ ok: true, id: result.id, row: result.row });
    } catch (err) {
        console.error('Erro em /api/nova-conta-fixa:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao cadastrar conta fixa.' });
    }
};
