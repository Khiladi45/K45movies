package com.vega

import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.ReactCookieJarContainer
import okhttp3.Cache
import okhttp3.ConnectionPool
import okhttp3.Dns
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.dnsoverhttps.DnsOverHttps
import java.io.File
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * Resolves every hostname through DNS-over-HTTPS (Cloudflare, then Google) and only then
 * falls back to the system resolver. Indian ISPs poison/blocked-page many provider and CDN
 * domains at the DNS level, which makes axios calls and ExoPlayer downloads fail on a plain
 * client. React Native's network module, Fresco and react-native-video (DataSourceUtil uses
 * OkHttpClientProvider.getOkHttpClient()) all share the client built here.
 */
class K45DohOkHttpFactory(private val cacheDir: File) : OkHttpClientFactory {

    private val connectionPool = ConnectionPool()

    private val bootstrapClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cache(Cache(File(cacheDir, "k45_dns_cache"), 5L * 1024 * 1024))
            .connectTimeout(8, TimeUnit.SECONDS)
            .readTimeout(8, TimeUnit.SECONDS)
            .build()
    }

    private fun doh(url: String, vararg ips: String): Dns? = try {
        DnsOverHttps.Builder()
            .client(bootstrapClient)
            .url(url.toHttpUrl())
            .bootstrapDnsHosts(ips.map { InetAddress.getByName(it) })
            .build()
    } catch (e: Exception) {
        null
    }

    private val resolvers: List<Dns> by lazy {
        listOfNotNull(
            doh("https://1.1.1.1/dns-query", "1.1.1.1", "1.0.0.1"),
            doh("https://dns.google/dns-query", "8.8.8.8", "8.8.4.4"),
        )
    }

    private val dns = object : Dns {
        override fun lookup(hostname: String): List<InetAddress> {
            // Never send loopback / literal IPs through DoH.
            if (hostname == "localhost" || hostname == "127.0.0.1") return Dns.SYSTEM.lookup(hostname)
            for (resolver in resolvers) {
                try {
                    val result = resolver.lookup(hostname)
                    if (result.isNotEmpty()) return result
                } catch (_: Exception) {
                    // try the next resolver
                }
            }
            return try {
                Dns.SYSTEM.lookup(hostname)
            } catch (e: UnknownHostException) {
                throw e
            }
        }
    }

    override fun createNewNetworkModuleClient(): OkHttpClient =
        OkHttpClient.Builder()
            .dns(dns)
            .connectionPool(connectionPool)
            .retryOnConnectionFailure(true)
            .cookieJar(ReactCookieJarContainer())
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
}
