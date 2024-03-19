library(easystats)
library(tidyverse)
library(brms)
library(patchwork)

# Make function to generate data
generate_data <- function(n_trials=25, effect_sd = 0.4, intercept_sd=0.4, noise=0.8, name="df") {
  df <- data.frame()
  for(participant in 1:20) {
    x <- rnorm(n_trials, 0, 1)
    y <- (1 + rnorm(1, 0, effect_sd)) * x + rnorm(1, 0, intercept_sd)
    y <- y + rnorm(n_trials, 0, noise)
    df <- rbind(df, data.frame(Difficulty=x, RT=y,
                               Participant=paste0("S", participant)))
  }
  df$Name <- name
  df
}

# Generate 4 datasets
df1 <- generate_data(n_trials=20, effect_sd = 0.5, intercept_sd=0.5, name="1. Intercept and Effect")
df2 <- generate_data(n_trials=20, effect_sd = 0.1, intercept_sd=0.5, name="2. Intercept Only")
df3 <- generate_data(n_trials=20, effect_sd = 0.5, intercept_sd=0.1, name="3. Effect Only")
df4 <- generate_data(n_trials=200, effect_sd = 0.5, intercept_sd=0.5, name="4. More trials")


# Plot data
p1 <- rbind(df1, df2, df3, df4) |>
  ggplot(aes(x=Difficulty, y=RT, color=Participant, fill=Participant)) +
  geom_point2(alpha=0.5) +
  geom_smooth(method="lm", se=TRUE, alpha=0.2) +
  theme_minimal() +
  scale_fill_material_d() +
  scale_color_material_d() +
  facet_wrap(~Name, scales="free")
p1
ggsave("fig1.png", p1, width=10, height=10, dpi=200, bg="white")


model1 <- brms::brm(RT ~ Difficulty + (1+Difficulty|Participant), data=df1, iter=600)
model2 <- brms::brm(RT ~ Difficulty + (1+Difficulty|Participant), data=df2, iter=600)
model3 <- brms::brm(RT ~ Difficulty + (1+Difficulty|Participant), data=df3, iter=600)
model4 <- brms::brm(RT ~ Difficulty + (1+Difficulty|Participant), data=df4, iter=600)

# Random effects extraction
extract_individual <- function(model, name="df") {
  coefs <- coef(model, summary=FALSE)$Participant
  data <- rbind(
    as.data.frame(coefs[, , "Intercept"]) |>
      pivot_longer(everything(), names_to="Participant", values_to="Value") |>
      mutate(Parameter="Intercept", Name=name),
    as.data.frame(coefs[, , "Difficulty"]) |>
      pivot_longer(everything(), names_to="Participant", values_to="Value") |>
      mutate(Parameter="Difficulty", Name=name)
  )
  data
}

re1 <- extract_individual(model1, "1. Intercept and Effect")
re2 <- extract_individual(model2, "2. Intercept Only")
re3 <- extract_individual(model3, "3. Effect Only")
re4 <- extract_individual(model4, "4. More trials")


# Plot Random effects
p2 <- rbind(re1, re2, re3, re4) |>
  ggplot(aes(x=Value, y=Participant, fill=Participant)) +
  ggdist::stat_slabinterval(adjust=2, linewidth=0.5, size=0.5) +
  scale_fill_material_d() +
  theme_minimal() +
  facet_grid(Name~Parameter, scales="free")
p2
ggsave("fig2.png", p2, width=9, height=12, dpi=200, bg="white")






scores <- rbind(re1, re2, re3, re4) |>
  summarize(
    Mean = mean(Value),
    SD = sd(Value),
    .by = c("Name", "Parameter", "Participant")
  )
head(scores)
knitr::kable(head(scores), digits=2)


summarize(scores,
          SNR = sd(Mean) / mean(SD),
          .by=c("Name", "Parameter")) |>
  knitr::kable(digits=2)
