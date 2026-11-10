use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHttpHeader {
    name: String,
    value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHttpJsonRequest {
    url: String,
    headers: Vec<DesktopHttpHeader>,
    body: Option<String>,
    method: Option<String>,
    timeout_ms: Option<u64>,
    max_response_bytes: Option<usize>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopHttpResponse {
    status: u16,
    body: String,
    headers: Vec<DesktopHttpHeader>,
}

#[tauri::command]
pub async fn desktop_http_post_json(request: DesktopHttpJsonRequest) -> Result<DesktopHttpResponse, String> {
    let url = parse_allowed_url(&request.url)?;
    let headers = build_headers(&request.headers)?;
    let timeout_ms = request.timeout_ms.unwrap_or(45_000).clamp(2_000, 180_000);
    let client = reqwest::Client::builder()
        // parse_allowed_url validates only the first hop. Following a 3xx would
        // let a provider or relay redirect this process to loopback or a LAN
        // address and bypass both the scheme and host checks below.
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_millis(timeout_ms))
        .build()
        .map_err(|error| format!("无法创建桌面网络请求：{error}"))?;

    let method = match request.method.as_deref().unwrap_or("POST") {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("仅允许 GET 或 POST 请求。".to_string()),
    };
    let builder = client.request(method.clone(), url).headers(headers);
    let builder = if method == reqwest::Method::POST {
        builder.body(request.body.unwrap_or_default())
    } else {
        builder
    };
    let mut response = builder
        .send()
        .await
        .map_err(|error| format!("接口地址不可达：{error}"))?;
    let status = response.status().as_u16();
    let response_headers = response_headers(response.headers());
    let limit = request.max_response_bytes.unwrap_or(8 * 1024 * 1024).clamp(1, 64 * 1024 * 1024);
    let too_large = || "AI 服务响应过大，已停止读取。请减少输出或检查服务地址后重试。".to_string();
    if response.content_length().is_some_and(|length| length > limit as u64) {
        return Err(too_large());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|error| format!("读取接口响应失败：{error}"))? {
        if chunk.len() > limit - bytes.len() {
            return Err(too_large());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8_lossy(&bytes).into_owned();

    Ok(DesktopHttpResponse {
        status,
        body,
        headers: response_headers,
    })
}

fn parse_allowed_url(value: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(value.trim()).map_err(|_| "请求地址不是有效 URL。".to_string())?;

    match url.scheme() {
        "https" => Ok(url),
        "http" if is_local_http_url(&url) => Ok(url),
        "http" => Err("请求地址只允许 HTTPS；HTTP 只允许 localhost、127.0.0.1 或 ::1。".to_string()),
        _ => Err("请求地址只支持 HTTPS，或本机回环地址的 HTTP。".to_string()),
    }
}

fn is_local_http_url(url: &reqwest::Url) -> bool {
    matches!(
        url.host_str(),
        Some("localhost") | Some("127.0.0.1") | Some("::1") | Some("[::1]")
    )
}

fn is_forbidden_header(name: &str) -> bool {
    const FORBIDDEN: [&str; 8] = [
        "host",
        "cookie",
        "content-length",
        "connection",
        "transfer-encoding",
        "proxy-authorization",
        "expect",
        "upgrade",
    ];

    FORBIDDEN.iter().any(|forbidden| name.eq_ignore_ascii_case(forbidden))
}

fn build_headers(headers: &[DesktopHttpHeader]) -> Result<HeaderMap, String> {
    let mut result = HeaderMap::new();

    for header in headers {
        let name = header.name.trim();

        if name.is_empty() {
            continue;
        }

        if is_forbidden_header(name) {
            return Err(format!("请求头不允许覆盖：{name}"));
        }

        let header_name = HeaderName::from_bytes(name.as_bytes())
            .map_err(|_| format!("请求头名称不合法：{name}"))?;
        let header_value = HeaderValue::from_str(&header.value)
            .map_err(|_| format!("请求头值不合法：{name}"))?;

        result.insert(header_name, header_value);
    }

    Ok(result)
}

fn response_headers(headers: &HeaderMap) -> Vec<DesktopHttpHeader> {
    headers
        .iter()
        .filter_map(|(name, value)| {
            if name.as_str().eq_ignore_ascii_case("set-cookie") {
                return None;
            }

            Some(DesktopHttpHeader {
                name: name.to_string(),
                value: value.to_str().unwrap_or("").to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    fn local_response(raw: &'static [u8], limit: usize) -> Result<DesktopHttpResponse, String> {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
            let mut request = [0; 4096];
            socket.read(&mut request).unwrap();
            // Rejection may close the connection before the complete write.
            let _ = socket.write_all(raw);
        });
        let result = tauri::async_runtime::block_on(desktop_http_post_json(DesktopHttpJsonRequest {
            url: format!("http://{address}"), headers: vec![], body: None,
            method: Some("GET".into()), timeout_ms: Some(3000), max_response_bytes: Some(limit),
        }));
        server.join().unwrap();
        result
    }

    #[test]
    fn rejects_declared_oversized_response() {
        let result = local_response(b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\nConnection: close\r\n\r\nabcdefghijkl", 8);
        assert!(result.unwrap_err().contains("AI 服务响应过大"));
    }

    #[test]
    fn does_not_follow_redirects_to_an_unvalidated_host() {
        let result = local_response(
            b"HTTP/1.1 302 Found\r\nLocation: http://169.254.169.254/latest/meta-data/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            1024,
        )
        .unwrap();
        assert_eq!(result.status, 302);
        assert!(result.body.is_empty());
    }

    #[test]
    fn rejects_headers_that_could_retarget_the_request() {
        for name in ["Host", "cookie", "Content-Length", "Connection"] {
            let error = build_headers(&[DesktopHttpHeader { name: name.to_string(), value: "x".into() }])
                .err()
                .unwrap();
            assert!(error.contains("请求头不允许覆盖"), "{name} was accepted");
        }
    }

    #[test]
    fn rejects_oversized_chunked_response_without_content_length() {
        let result = local_response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n6\r\nabcdef\r\n6\r\nghijkl\r\n0\r\n\r\n", 8);
        assert!(result.unwrap_err().contains("AI 服务响应过大"));
    }

    #[test]
    fn keeps_complete_utf8_json_across_http_chunks() {
        let response = local_response(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n7\r\n{\"x\":\"\xe4\r\n4\r\n\xb8\xad\"}\r\n0\r\n\r\n", 32).unwrap();
        assert_eq!(response.status, 200);
        assert_eq!(response.body, "{\"x\":\"中\"}");
    }
}
