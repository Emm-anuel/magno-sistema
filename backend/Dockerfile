# ── Stage 1: Build ──────────────────────────────────────────────────
FROM maven:3.9.7-eclipse-temurin-17 AS build
WORKDIR /app

# Copiar solo el pom primero para aprovechar el cache de capas
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Copiar fuentes y compilar
COPY src ./src
RUN mvn package -DskipTests -q

# ── Stage 2: Runtime ─────────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Usuario no-root
RUN addgroup -S magno && adduser -S magno -G magno
USER magno

COPY --from=build /app/target/magno-sistema-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-prod}", \
  "-jar", "app.jar"]
