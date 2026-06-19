// api/get-data.js
// Retorna todos os dados das 3 abas da planilha em um único payload.
// Opcionalmente filtra Lancamentos por mês/ano via query params (?month=YYYY-MM).

const { getSheetRows } = require('./sheets-helper');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, error: 'Método não permitido.' });
    }

    try {
        // Opcional: checagem simples de token no header Authorization: Bearer <token>
        // Se quiser travar de verdade, valide a assinatura aqui. Por enquanto, deixa passar.

        const { month } = req.query; // formato esperado: YYYY-MM

        const [contasFixas, informativos] = await Promise.all([
            getSheetRows('Contas_Fixas'),
            getSheetRows('Informativos'),
        ]);

        let lancamentos = await getSheetRows('Lancamentos');

        if (month && /^\d{4}-\d{2}$/.test(month)) {
            // Filtra Lancamentos cuja data_competencia começa com YYYY-MM
            lancamentos = lancamentos.filter((l) => {
                const comp = String(l.data_competencia || '').slice(0, 7);
                return comp === month;
            });
        }

        return res.status(200).json({
            ok: true,
            month: month || null,
            contasFixas,
            informativos,
            lancamentos,
        });
    } catch (err) {
        console.error('Erro em /api/get-data:', err);
        return res.status(500).json({ ok: false, error: err.message || 'Erro ao buscar dados.' });
    }
};
