FROM nginx:alpine
ARG SITE_URL=http://localhost:8080
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
RUN cd /usr/share/nginx/html \
 && SITE="${SITE_URL%/}" \
 && sed -i "s|__SITE_URL__|${SITE}|g" index.html \
 && printf 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' "$SITE" > robots.txt \
 && printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>%s/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url></urlset>\n' "$SITE" > sitemap.xml
EXPOSE 80
