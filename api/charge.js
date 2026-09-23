// api/charge.js
// Função serverless da Vercel. Roda no servidor — a chave secreta da NovaPay
// nunca é exposta ao navegador do cliente.
//
// Configure na Vercel (Project Settings > Environment Variables):
//   NOVAPAY_CLIENT_ID     -> valor do header "ci"
//   NOVAPAY_CLIENT_SECRET -> valor do header "cs"

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, description, customer } = req.body || {};

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Campo "amount" é obrigatório e deve ser um número maior que zero (em reais).' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Campo "description" é obrigatório.' });
  }

  const clientId = process.env.NOVAPAY_CLIENT_ID;
  const clientSecret = process.env.NOVAPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Credenciais da NovaPay não configuradas no servidor.' });
  }

  // TODO: confirmar com a documentação da NovaPay se existem outros campos
  // obrigatórios (ex: dados do cliente, callback_url para webhook, etc.)
  const payload = {
    amount,
    description,
    ...(customer ? { customer } : {}),
  };

  try {
    const novapayResponse = await fetch('https://api.anovapay.com.br/charges', {
      method: 'POST',
      headers: {
        ci: clientId,
        cs: clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await novapayResponse.json();

    if (!novapayResponse.ok) {
      return res.status(novapayResponse.status).json({ error: 'Erro ao criar cobrança na NovaPay', details: data });
    }

    // TODO: ajustar os nomes dos campos abaixo assim que soubermos o formato
    // exato da resposta da NovaPay (qual campo traz o código copia-e-cola e
    // qual traz a imagem/URL do QR code).
    return res.status(200).json({
      id: data.id,
      pix_copy_paste: data.pix_copy_paste ?? data.qr_code ?? null,
      qr_code_image: data.qr_code_image ?? data.qr_code_url ?? null,
      status: data.status,
      raw: data,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao conectar com a NovaPay', details: String(err) });
  }
}
