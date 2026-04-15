import fetch from 'node-fetch';

export default async function handler(req, res) {
    try {
        const { turno = '1', cargo = '1', uf = 'br' } = req.query || {};

        let eleicao = '544';
        if (cargo === '1') {
            eleicao = (turno === '2') ? '545' : '544';
        } else {
            eleicao = (turno === '2') ? '547' : '546';
        }

        const cargoFormatado = String(cargo).padStart(4, '0');
        const ufFormatada = uf.toLowerCase();

        const url = `https://resultados.tse.jus.br/oficial/ele2022/${eleicao}/dados-simplificados/${ufFormatada}/${ufFormatada}-c${cargoFormatado}-e000${eleicao}-r.json`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (!response.ok) {
            return res.status(500).json({ erro: true });
        }

        const data = await response.json();

        return res.status(200).json({
            sucesso: true,
            totalCandidatos: data?.cand?.length || 0
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ erro: true, detalhe: err.message });
    }
}