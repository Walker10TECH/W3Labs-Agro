import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
// A porta 3000 é usada aqui, correspondendo à alteração no frontend.
const PORT = 3000; 
const OLLAMA_API_URL = 'http://127.0.0.1:11434/api/chat';

app.use(cors()); // Permite requisições do seu app React Native
app.use(express.json());

// Esta rota atuará como um proxy para o endpoint de chat do Ollama
app.post('/api/chat', async (req, res) => {
  try {
    // O corpo da requisição (req.body) vindo do seu frontend
    // já está no formato que o Ollama espera para /api/chat.
    // Nós apenas o encaminhamos.
    const ollamaResponse = await axios.post(
      OLLAMA_API_URL,
      req.body,
      {
        responseType: 'stream', // Essencial para receber a resposta como um stream
      }
    );

    // Define o cabeçalho para indicar que é um stream de JSON (NDJSON)
    res.setHeader('Content-Type', 'application/x-ndjson');

    // Encaminha o stream de dados do Ollama diretamente para o cliente (seu app)
    ollamaResponse.data.pipe(res);

  } catch (error) {
    console.error('Erro ao fazer proxy para o Ollama:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Falha ao conectar com o serviço de IA local (Ollama).' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor proxy para Ollama rodando na porta ${PORT}`);
  console.log(`As requisições do seu app devem ser feitas para http://localhost:${PORT}`);
});
