from ollama import Client
from pinecone import Pinecone

from src.adapters.embedding.ollama import OllamaEmbeddingAdapter
from src.adapters.vector_store.pinecone import PineconeVectorStoreAdapter
from src.application.document_retrieval_service import DocumentRetrievalService
from src.core.config import get_settings
from src.db.session import get_db

CHUNK_ID = "903eaddca2334a78a49400669644a07c"
QUERY = "Which protocol provides reliable delivery?"

s = get_settings()

with Client(
    host=s.embedding_base_url,
    timeout=s.embedding_timeout,
) as client:
    embedding = OllamaEmbeddingAdapter(
        client=client,
        model=s.embedding_model,
        dimension=s.embedding_dimension,
    )

    vector = client.embed(
        model=s.embedding_model,
        input="StudySync Sprint 3 demo",
    ).embeddings[0]

    print("=== EMBEDDING ===")
    print("Model:", s.embedding_model)
    print("Dimensions:", len(vector))

    pc = Pinecone(api_key=s.pinecone_api_key)
    index = pc.index(s.pinecone_index_name)

    stored = index.documents.fetch(
        namespace=s.pinecone_namespace,
        ids=[CHUNK_ID],
    ).documents[CHUNK_ID]

    print("\n=== PINECONE ===")
    print("Course:", stored.course_id)
    print("Source:", stored.source_start_label)
    print("Stored dimensions:", len(stored.embedding))

    vector_store = PineconeVectorStoreAdapter(
        index=index,
        namespace=s.pinecone_namespace,
        batch_size=s.pinecone_batch_size,
    )

    db_gen = get_db()
    db = next(db_gen)

    try:
        retrieval = DocumentRetrievalService(
            db=db,
            embedding_port=embedding,
            vector_store=vector_store,
        )

        results = retrieval.retrieve(
            query=QUERY,
            course_id="cs101",
            top_k=5,
        )

        print("\n=== RETRIEVAL ===")
        print("Query:", QUERY)
        print("Results:", len(results))

        if results:
            result = results[0]
            print("Score:", result.score)
            print("Source:", result.metadata.get("source_start_label"))
            print("Text:", result.text[:220], "...")

    finally:
        db_gen.close()