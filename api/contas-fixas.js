// api/contas-fixas.js
// GET /api/contas-fixas
// Retorna todas as contas fixas cadastradas na aba "Contas_Fixas".
// Não filtra por mês: o frontend precisa da lista completa para popular
// o <select> do modal "Pagar Conta Fixa".

const { getSheetRows, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'GET')) return;

    try {
        const contasFixas = await getSheetRows('Contas_Fixas');
        return res.status(200).json({ ok: true, contasFixas });
    } catch (err) {
        console.error('Erro em /api/contas-fixas:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao buscar contas fixas.' });
    }
};
