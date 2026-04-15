export default async function handler(req, res) {
    try {
        const { turno = '1', cargo = '1', uf = 'br' } = req.query || {};

        // 1. Bloqueia se tentar buscar cargos regionais para o Brasil inteiro
        if (cargo !== '1' && uf.toLowerCase() === 'br') {
            return res.status(400).json({
                erro: true,
                mensagem: 'Selecione um Estado (UF) para ver os dados deste cargo.'
            });
        }

        // 2. Define o código da Eleição
        let eleicao = '544';
        if (cargo === '1') {
            eleicao = (turno === '2') ? '545' : '544';
        } else {
            eleicao = (turno === '2') ? '547' : '546';
        }

        // 3. Formata o cargo e a UF
        const cargoFormatado = String(cargo).padStart(4, '0');
        const ufFormatada = uf.toLowerCase();

        // 4. Monta a URL exata do arquivo JSON
        const url = `https://resultados.tse.jus.br/oficial/ele2022/${eleicao}/dados-simplificados/${ufFormatada}/${ufFormatada}-c${cargoFormatado}-e000${eleicao}-r.json`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Accept': 'application/json'
            }
        });

        // 5. TRATAMENTO INTELIGENTE DE ERROS DA API
        if (response.status === 404) {
            return res.status(404).json({
                erro: true,
                mensagem: turno === '2'
                    ? 'Não houve 2º turno para este cargo neste estado.'
                    : 'Dados não encontrados no TSE para esta consulta.'
            });
        }

        if (!response.ok) {
            throw new Error(`Erro na API do TSE: Status ${response.status}`);
        }

        const data = await response.json();

        if (!data.cand || data.cand.length === 0) {
            return res.status(404).json({ erro: true, mensagem: 'Nenhum candidato encontrado para este cargo/turno.' });
        }

        // 6. Mapeia TODOS os candidatos
        let todosCandidatos = data.cand.map(c => ({
            sqcand: c.sqcand,
            nome: c.nm,
            partido: c.cc,
            votos: c.pvap.replace(',', '.'),
            votosNumero: parseInt(c.vap) || 0,
            total: parseInt(c.vap).toLocaleString('pt-BR'),
            eleito: c.e === 's' || c.e === 'S',
            segundoTurno: c.e === '2t' || c.e === '2T',
            foto: `https://resultados.tse.jus.br/oficial/ele2022/${eleicao}/fotos/${ufFormatada}/${c.sqcand}.jpeg`
        }));

        // 7. ORDENA DO MAIOR PARA O MENOR
        todosCandidatos.sort((a, b) => b.votosNumero - a.votosNumero);

        // 8. Retorna a resposta completa que o seu Front-end espera
        return res.status(200).json({
            turno,
            percurso: data.pst || "0,00",
            atualizacao: data.dg && data.hg ? `${data.dg} às ${data.hg}` : 'Sem dados de hora',
            resumo: {
                validos: data.vv ? parseInt(data.vv).toLocaleString('pt-BR') : '--',
                pctValidos: data.pvv || '0,00',
                brancos: data.vb ? parseInt(data.vb).toLocaleString('pt-BR') : '--',
                pctBrancos: data.pvb || '0,00',
                nulos: data.tvn ? parseInt(data.tvn).toLocaleString('pt-BR') : '--',
                pctNulos: data.ptvn || '0,00',
                abstencoes: data.a ? parseInt(data.a).toLocaleString('pt-BR') : '--',
                pctAbstencoes: data.pa || '0,00'
            },
            candidatos: todosCandidatos
        });

    } catch (err) {
        console.error('Erro real de conexão:', err.message);
        return res.status(500).json({ erro: true, mensagem: 'Servidor do TSE indisponível ou erro interno.', detalhe: err.message });
    }
}