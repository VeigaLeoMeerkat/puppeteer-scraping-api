# Configurações
$baseUrl = "http://localhost:8001"
$token = "123"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

# Função para testar a rota raiz
function Test-RootEndpoint {
    Write-Host "`nTestando rota raiz (GET /)..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/" -Method Get
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Resposta:"
        $data | ConvertTo-Json -Depth 3
    }
    catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
}

# Função para testar o health check
function Test-HealthCheck {
    Write-Host "`nTestando health check (GET /health)..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/health" -Method Get
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Resposta:"
        $data | ConvertTo-Json -Depth 3
    }
    catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
}

# Função para testar o scraping
function Test-Scraping {
    param (
        [string]$url
    )
    Write-Host "`nTestando scraping em HTML (POST /scrape)..." -ForegroundColor Cyan
    try {
        $body = @{
            url = $url
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$baseUrl/scrape" -Method Post -Headers $headers -Body $body
        $data = $response.Content | ConvertFrom-Json
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Resposta:"
        $data | ConvertTo-Json -Depth 3
    }
    catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
	
	Write-Host "`nTestando scraping em PDF (POST /scrape)..." -ForegroundColor Cyan
    try {
        $body = @{
            url = $url
			pdfOutput = $true
        } | ConvertTo-Json

        $response = Invoke-WebRequest -Uri "$baseUrl/scrape" -Method Post -Headers $headers -Body $body
        Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "Resposta:"
        $response.Headers | ConvertTo-Json
    }
    catch {
        Write-Host "Erro: $_" -ForegroundColor Red
    }
}

# Executar testes
Write-Host "Iniciando testes da API..." -ForegroundColor Yellow
Test-RootEndpoint
Test-HealthCheck
Test-Scraping -url "https://example.com"