// api/lancamentos.js
// GET /api/lancamentos?mes=YYYY-MM
// Retorna os lançamentos (gastos, receitas e pagamentos de contas fixas).
// Se `mes` for passado (formato YYYY-MM), filtra por data_competencia.
// Cada lançamento pode conter `conta_fixa_id` (quando for pagamento de fixa)
// — o frontend usa esse ID para fazer o cruzamento reverso com a aba
// "Contas_Fixas" e exibir a descrição correta.

const { getSheetRows, handlePreflightOrMethod } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    if (handlePreflightOrMethod(req, res, 'GET')) return;

    try {
        const { mes } = req.query; // YYYY-MM
        let lancamentos = await getSheetRows('Lancamentos');

        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            lancamentos = lancamentos.filter((l) => {
                const comp = String(l.data_competencia || '').slice(0, 7);
                return comp === mes;
            });
        }

        return res.status(200).json({ ok: true, lancamentos });
    } catch (err) {
        console.error('Erro em /api/lancamentos:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao buscar lançamentos.' });
    }
};
