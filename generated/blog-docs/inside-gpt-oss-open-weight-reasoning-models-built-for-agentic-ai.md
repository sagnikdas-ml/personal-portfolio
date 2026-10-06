---
title: "Inside GPT-OSS: Open-Weight Reasoning Models Built for Agentic AI"
description: "A practical overview of GPT-OSS, its architecture, tool use, reasoning setup, and what open-weight deployment changes for developers."
category: "Model Notes"
date: "2026-01-22"
tags:
  - "GPT-OSS"
  - "open-weight models"
  - "reasoning models"
  - "LLMs"
  - "OpenAI"
---
<a class="blog-back-link" href="../">← Back to blog</a>

<div class="blog-post-meta">
  <span class="blog-post-category">Model Notes</span>
  <span>Jan 22, 2026</span>
  <span>7 min read</span>
</div>

# Inside GPT-OSS: Open-Weight Reasoning Models Built for Agentic AI

<div class="blog-tag-row"><span class="blog-tag">GPT-OSS</span><span class="blog-tag">open-weight models</span><span class="blog-tag">reasoning models</span><span class="blog-tag">LLMs</span><span class="blog-tag">OpenAI</span></div>

GPT-OSS refers to a pair of open-weight reasoning models, released under the Apache 2.0 license: [gpt-oss-20b](https://huggingface.co/openai/gpt-oss-20b) and [gpt-oss-120b](https://huggingface.co/openai/gpt-oss-120b). Unlike proprietary ChatGPT, GPT-OSS is designed to be run, modified, and fine-tuned by developers. The models are optimized for agentic workflows, long-form reasoning, tool use, and structured outputs.

This article provides a practical overview of GPT-OSS, its architecture, training pipeline, reasoning abilities, and how it fits in today’s model landscape.

## GPT-OSS is much more flexible than ChatGPT

- Open-weight and flexible, allowing for tweaking and experimentation
- Designed for agentic workflows such as Python execution and web search
- Capable of long chain-of-thought reasoning
- Customizable by developers

OpenAI operates ChatGPT as one of the most widely used public conversational AI systems, so the company releasing an open-weight model naturally attracted a lot of attention in both academia and industry. However, GPT-OSS has a very different safety profile from ChatGPT and the OpenAI API. That difference is not due to weaker training, but because open-weight models cannot rely on centralized, system-level safeguards once they are released.

GPT-OSS-20B is meant to be used on regular consumer hardware with a minimum of 16 GB of memory, whereas GPT-OSS-120B is meant to be used on servers. While ChatGPT works out of the box, GPT-OSS requires some basic coding to get it running. In practice, a small Python script is enough to get started. For quick experimentation, Hugging Face also provides an inference option on the model landing pages, although that remains a hosted convenience rather than the core point of the release.

## Architecture overview

GPT-OSS models are autoregressive **Mixture-of-Experts (MoE)** transformers built on architectural ideas from GPT-2 and GPT-3.

### Model sizes

- **GPT-OSS-120B:** 116.8B total parameters, 36 layers, 5.1B active parameters per token
- **GPT-OSS-20B:** 20.9B total parameters, 24 layers, 3.6B active parameters per token

Only a subset of experts is active per token, which keeps inference more efficient than the total parameter count might suggest.

## Quantization and hardware efficiency

GPT-OSS applies post-training quantization to MoE weights using the **MXFP4** format, roughly 4.25 bits per parameter. This reduces memory requirements enough that local inference becomes realistic for smaller teams and individual developers.

That enables:

- GPT-OSS-120B to run on an 80 GB GPU
- GPT-OSS-20B to run with only 16 GB of memory

That matters for privacy-sensitive or low-infrastructure use cases. Tasks involving payslips, banking documents, or medical information can be processed locally without sending data to a remote API. Without quantization, most individual researchers, small companies, and regular users would not be able to work with models of this quality on their own systems.

## Tokenizer

TikToken is a tokenizer library maintained by OpenAI. GPT-OSS uses the **o200k_harmony** tokenizer, which is a Byte Pair Encoding tokenizer extended with special tokens for role-based and channel-based chat formatting.

## Pretraining

### Data

GPT-OSS models are trained on a text-only dataset containing trillions of tokens with emphasis on:

- STEM and mathematics
- Programming and code
- General knowledge

Harmful content, including biosecurity-related material, was filtered using CBRN pretraining filters originally developed for GPT-4o.

### Training infrastructure

Training was conducted on NVIDIA H100 GPUs using PyTorch with expert-optimized Triton kernels and FlashAttention.

- **GPT-OSS-120B:** approximately 2.1M H100 GPU-hours
- **GPT-OSS-20B:** approximately 10x fewer GPU-hours

## Post-training and reasoning

After pretraining, the models were post-trained using chain-of-thought reinforcement learning, similar in spirit to how OpenAI’s reasoning-focused models were trained.

They are taught:

- How to reason step by step
- How to solve complex math and coding problems
- How to use tools such as Python execution and web browsing

### Harmony chat format

GPT-OSS uses the Harmony chat format, a role-based messaging structure with explicit message boundaries such as System, Developer, User, and Assistant.

The format also introduces explicit channels:

- **analysis:** internal chain-of-thought
- **commentary:** tool calls
- **final:** user-visible output

This structure enables more advanced agentic behavior, but it also requires careful handling, especially in multi-turn conversations and tool-heavy applications.

### Variable reasoning effort

In ChatGPT, users are familiar with settings like Auto, Instant, Thinking, Pro, and Deep Research. GPT-OSS exposes a similar idea through three effort levels:

- `low`
- `medium`
- `high`

These are set via prompt-level instructions such as `Reasoning: high`. Higher effort generally produces longer reasoning traces and better performance, at the cost of latency and compute.

### Agentic tool use

GPT-OSS models are trained to interact with:

- Web browsing via search and page access tools
- Python code execution in a stateful environment
- Arbitrary developer-defined functions with schemas

Tool use can be enabled or disabled through prompting and application design.

## Evaluation results

### Reasoning and coding

Among offline and locally runnable models, GPT-OSS is particularly strong on reasoning-heavy tasks, mathematics, coding, and structured tool use. GPT-OSS-20B reportedly uses over 20k chain-of-thought tokens per AIME problem on average. GPT-OSS-120B approaches the performance of OpenAI’s smaller frontier reasoning models on some coding and tool benchmarks.

![GPT-OSS reasoning and coding benchmark](https://cdn.hashnode.com/res/hashnode/image/upload/v1769036445897/d6189b25-4c5c-4655-92e0-d1d6664eb265.png)

### Health performance

GPT-OSS also performs competitively on HealthBench evaluations.

![GPT-OSS HealthBench comparison](https://cdn.hashnode.com/res/hashnode/image/upload/v1769035826187/175341f9-ffc8-4790-9ca4-2e7b7ba1b172.png)

GPT-OSS-120B approaches OpenAI o3 on some health-focused benchmarks and outperforms several closed models. That said, advice from a language model is still not a substitute for medical professionals.

### Multilingual performance

On MMMLU benchmarks across 14 languages, GPT-OSS-120B at high reasoning effort comes close to the performance of stronger hosted reasoning models.

![GPT-OSS multilingual benchmark](https://cdn.hashnode.com/res/hashnode/image/upload/v1769036019896/24ef00ce-5fad-4245-8f96-cf51a87f9bf7.png)

## Safety and limitations

Even the best systems have limitations, and GPT-OSS is no exception. As an open-weight release, it does not inherit the same deployment safeguards as a centrally hosted product.

### Preparedness framework

GPT-OSS-120B does not reach OpenAI’s “High capability” thresholds under the Preparedness Framework, even after adversarial fine-tuning.

- Biological and chemical capability
- Cyber capability
- AI self-improvement

### Disallowed content and jailbreaks

On standard disallowed-content evaluations, both models perform on par with OpenAI o4-mini in some categories. GPT-OSS-20B underperforms on some illicit or violent categories but still exceeds older mainstream models. Robustness to jailbreaks using StrongReject is reported to be comparable to o4-mini.

![GPT-OSS safety benchmark](https://cdn.hashnode.com/res/hashnode/image/upload/v1769036374502/35b6ebd3-c7fe-4964-82fd-ca56b4d9f3a3.png)

### Instruction hierarchy

All public chat models need to respect instruction hierarchy to function reliably as assistants. GPT-OSS follows system and developer priorities, but it underperforms stronger hosted models on tests such as system prompt extraction and prompt injection resistance.

![GPT-OSS instruction hierarchy benchmark](https://cdn.hashnode.com/res/hashnode/image/upload/v1769036661898/20ceb3df-a6e5-4b42-90e2-688c4892ccfd.png)

### Chain-of-thought and hallucinations

GPT-OSS chain-of-thought is intentionally less constrained. That means:

- Chain-of-thought may contain hallucinations
- Chain-of-thought may include unsafe or unfiltered language

Researchers have noted that when models are discouraged from expressing certain internal reasoning, they can learn to conceal the reasoning while still behaving incorrectly. For that reason, developers are generally advised not to expose raw chain-of-thought to end users.

### Fairness and bias

On BBQ fairness benchmarks, GPT-OSS models reportedly perform at roughly the same level as OpenAI o4-mini.

![GPT-OSS fairness benchmark](https://cdn.hashnode.com/res/hashnode/image/upload/v1769037084369/f89d26fc-827b-4b39-94f4-33332b19be27.png)

## Conclusion

GPT-OSS represents a meaningful step forward for open-weight reasoning models. It combines long chain-of-thought reasoning, agentic tool use, and strong math and coding performance in a form developers can actually inspect and control.

The technical freedom is real, but so is the shift in responsibility. Safety, deployment, and monitoring are no longer handled by a centralized API. They become the job of the system builder. GPT-OSS is not a drop-in replacement for ChatGPT, but for teams building agentic systems, it is a powerful foundation.

## References

1. OpenAI *et al.*, “gpt-oss-120b & gpt-oss-20b Model Card,” Aug. 08, 2025, *arXiv*: arXiv:2508.10925. doi: [10.48550/arXiv.2508.10925](https://doi.org/10.48550/arXiv.2508.10925).

<details>
<summary>Disclaimer</summary>
<p>All images and tables are reproduced from the referenced model card. The cover image source is the public GPT-OSS documentation and model materials. This article is an independent technical summary and interpretation of the OpenAI GPT-OSS model card. The author is not affiliated with OpenAI, and any opinions or interpretations are solely those of the author.</p>
</details>
