# Figures for the lighthouse plots post.
#
#   Rscript news/2026-lighthouse-plots/make_figures.R
#
# Writes trap.png, reveal.png and lighthouse.png (1100 px wide, for the body)
# next to this script. The header, featured.gif, is make_featured.py's.
#
# The two studies share the same 30 numbers in A and the same 30 numbers in B.
# Only the pairing differs: in Study 2, B is shuffled across participants. So
# every per-condition summary (means, SDs, CIs, densities) is identical, and so
# is the mean difference; only the variability of the differences changes.

library(ggplot2)
library(ggdist)
library(lme4)
library(modelbased)
library(see)
library(patchwork)

here <- tryCatch(dirname(normalizePath(sys.frame(1)$ofile)), error = function(e) {
  args <- commandArgs(trailingOnly = FALSE)
  file <- sub("^--file=", "", args[grep("^--file=", args)])
  if (length(file)) dirname(normalizePath(file)) else getwd()
})

# Data ----------------------------------------------------------------------

set.seed(398)
n <- 30
a <- rnorm(n, mean = 50, sd = 10)
b <- a + 3 + rnorm(n, mean = 0, sd = 1.5) # everyone goes up, a little
shuffled <- sample(n)

make_study <- function(a, b, name) {
  data.frame(
    Study = name,
    Participant = factor(rep(seq_along(a), 2)),
    Condition = factor(rep(c("A", "B"), each = length(a))),
    Score = c(a, b)
  )
}
study1 <- make_study(a, b, "Study 1")
study2 <- make_study(a, b[shuffled], "Study 2")
data <- rbind(study1, study2)

# Models: one per study ------------------------------------------------------

fit <- function(d) {
  model <- lmer(Score ~ Condition + (1 | Participant), data = d)
  list(
    means = estimate_means(model, by = "Condition"),
    contrasts = estimate_contrasts(model, contrast = "Condition")
  )
}
results <- list("Study 1" = fit(study1), "Study 2" = fit(study2))

for (s in names(results)) {
  cat("\n====", s, "====\n")
  print(results[[s]]$means)
  print(results[[s]]$contrasts)
}

means <- do.call(rbind, lapply(names(results), function(s) {
  m <- as.data.frame(results[[s]]$means)
  m$Study <- s
  m
}))

# Shared look ----------------------------------------------------------------

colours <- c(A = "#2a78d6", B = "#eb6834")
x_of <- c(A = 1, B = 2)
x_raw <- c(A = 1.18, B = 1.82) # participants sit inside the two means

theme_post <- theme_modern(base_size = 12) +
  theme(
    legend.position = "none",
    strip.text = element_text(face = "bold", size = 13),
    panel.spacing.x = unit(2.5, "lines"),
    axis.title.x = element_text(margin = margin(t = 6)),
    plot.background = element_rect(fill = "white", colour = NA)
  )

base_plot <- function(d) {
  d$x <- x_of[as.character(d$Condition)]
  d$side <- ifelse(d$Condition == "A", "left", "right")
  means$x <- x_of[as.character(means$Condition)]

  ggplot(d, aes(x = x, y = Score)) +
    stat_slab(
      aes(fill = Condition, side = side),
      alpha = 0.35, scale = 0.55, normalize = "panels"
    ) +
    facet_wrap(~Study) +
    scale_x_continuous(breaks = 1:2, labels = c("A", "B"), expand = expansion(add = 0.7)) +
    scale_fill_manual(values = colours) +
    scale_colour_manual(values = colours) +
    labs(x = "Condition", y = "Score") +
    theme_post
}

mean_layer <- function() {
  m <- means
  m$x <- x_of[as.character(m$Condition)]
  geom_pointrange(
    data = m,
    aes(x = x, y = Mean, ymin = CI_low, ymax = CI_high, colour = Condition),
    linewidth = 1.2, size = 0.9, inherit.aes = FALSE
  )
}

save <- function(plot, file, width, height) {
  ggsave(file.path(here, file), plot,
    width = width / 150, height = height / 150, dpi = 150,
    device = ragg::agg_png, bg = "white"
  )
}

# 1. The trap: two identical-looking studies ---------------------------------

p_trap <- base_plot(data) + mean_layer()
save(p_trap, "trap.png", 1100, 560)

# 2. The reveal: each participant's two scores, joined -----------------------

paired <- data
paired$x <- x_raw[as.character(paired$Condition)]

p_reveal <- base_plot(data) +
  geom_line(
    data = paired, aes(x = x, y = Score, group = Participant),
    colour = "grey35", alpha = 0.55, linewidth = 0.5
  ) +
  geom_point(
    data = paired, aes(x = x, y = Score, colour = Condition),
    size = 1.6, alpha = 0.8
  ) +
  mean_layer()
save(p_reveal, "reveal.png", 1100, 560)

# 3. The lighthouses ---------------------------------------------------------

lighthouse <- function(s) {
  r <- results[[s]]
  lit <- as.data.frame(r$means)
  from <- lit$Mean[lit$Condition == "B"]

  plot(r$contrasts, r$means) +
    # see <= 0.14.2 orders the axis B, A; easystats/see#472 fixes this
    scale_x_discrete(limits = c("A", "B")) +
    # reading aid, not part of the plot: the height of the lighthouse
    annotate("segment",
      x = 2, xend = 0.75, y = from, yend = from,
      linetype = "dashed", colour = "grey40", linewidth = 0.5
    ) +
    coord_cartesian(ylim = c(44, 60)) +
    labs(title = s, x = "Condition", y = "Score") +
    theme_post +
    theme(plot.title = element_text(face = "bold", size = 13, hjust = 0.5))
}

p_lighthouse <- lighthouse("Study 1") + lighthouse("Study 2") +
  plot_layout(axes = "collect")
save(p_lighthouse, "lighthouse.png", 1100, 560)
