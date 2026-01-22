"""
Sample script to index test documents into the search system
Run this after starting PostgreSQL and Python API
"""
import requests
import json

# Python API endpoint
API_URL = "http://localhost:8001/api/index"

# Sample documents to index
sample_documents = [
    {
        "title": "Introduction to Machine Learning",
        "content": "Machine learning is a subset of artificial intelligence (AI) that focuses on building systems that can learn from and make decisions based on data. Unlike traditional programming where rules are explicitly coded, machine learning algorithms identify patterns in data and use those patterns to make predictions or decisions without being explicitly programmed for each scenario.",
        "url": "https://example.com/ml-intro",
        "source_type": "web",
        "metadata": {"category": "AI", "author": "Tech Blog"}
    },
    {
        "title": "Deep Learning Fundamentals",
        "content": "Deep learning is a specialized subset of machine learning that uses neural networks with multiple layers (hence 'deep') to progressively extract higher-level features from raw input. For example, in image processing, lower layers might identify edges, while higher layers might identify human-readable concepts like faces or objects.",
        "url": "https://example.com/deep-learning",
        "source_type": "web",
        "metadata": {"category": "AI", "author": "AI Research"}
    },
    {
        "title": "Natural Language Processing with Transformers",
        "content": "Natural Language Processing (NLP) is a field of AI that gives computers the ability to understand, interpret, and generate human language. Transformers, introduced in 2017, revolutionized NLP with their attention mechanisms. Models like BERT, GPT, and T5 have achieved state-of-the-art results on various NLP tasks including translation, summarization, and question answering.",
        "url": "https://example.com/nlp-transformers",
        "source_type": "web",
        "metadata": {"category": "NLP", "year": 2023}
    },
    {
        "title": "Computer Vision and Image Recognition",
        "content": "Computer vision is a field of AI that trains computers to interpret and understand the visual world. Using digital images from cameras and videos and deep learning models, machines can accurately identify and classify objects, and react to what they see. Applications range from facial recognition to autonomous vehicles and medical image analysis.",
        "url": "https://example.com/computer-vision",
        "source_type": "web",
        "metadata": {"category": "Computer Vision"}
    },
    {
        "title": "Reinforcement Learning Applications",
        "content": "Reinforcement learning is a type of machine learning where an agent learns to make decisions by performing actions in an environment to achieve maximum cumulative reward. It has been successfully applied to game playing (AlphaGo), robotics, autonomous driving, and resource management. The agent learns through trial and error, receiving feedback in the form of rewards or penalties.",
        "url": "https://example.com/reinforcement-learning",
        "source_type": "web",
        "metadata": {"category": "AI", "difficulty": "advanced"}
    },
    {
        "title": "Web Development Best Practices",
        "content": "Modern web development involves using HTML for structure, CSS for styling, and JavaScript for interactivity. Best practices include responsive design for mobile devices, accessibility considerations, performance optimization through lazy loading and code splitting, and secure coding practices to prevent vulnerabilities like XSS and SQL injection.",
        "url": "https://example.com/web-dev",
        "source_type": "web",
        "metadata": {"category": "Web Development"}
    },
    {
        "title": "Cloud Computing Fundamentals",
        "content": "Cloud computing delivers computing services including servers, storage, databases, networking, software, and analytics over the Internet. The main service models are IaaS (Infrastructure as a Service), PaaS (Platform as a Service), and SaaS (Software as a Service). Major providers include AWS, Azure, and Google Cloud Platform. Benefits include scalability, cost-effectiveness, and accessibility.",
        "url": "https://example.com/cloud-computing",
        "source_type": "web",
        "metadata": {"category": "Cloud"}
    },
    {
        "title": "Cybersecurity Essentials",
        "content": "Cybersecurity protects systems, networks, and data from digital attacks. Key concepts include encryption (protecting data in transit and at rest), authentication (verifying user identity), authorization (controlling access to resources), and security monitoring. Common threats include malware, phishing, ransomware, and DDoS attacks. Best practices involve regular updates, strong passwords, multi-factor authentication, and security awareness training.",
        "url": "https://example.com/cybersecurity",
        "source_type": "web",
        "metadata": {"category": "Security"}
    },
    {
        "title": "Database Design and SQL",
        "content": "Database design involves organizing data efficiently and logically. Relational databases use tables with rows and columns, connected through foreign keys. SQL (Structured Query Language) is used to query and manipulate data. Key concepts include normalization (reducing redundancy), indexing (improving query performance), and transactions (ensuring data consistency). Modern databases also include NoSQL options like MongoDB and Cassandra for different use cases.",
        "url": "https://example.com/database-sql",
        "source_type": "web",
        "metadata": {"category": "Database"}
    },
    {
        "title": "Agile Software Development",
        "content": "Agile is an iterative approach to software development and project management that helps teams deliver value faster and with fewer headaches. Instead of betting everything on a big launch, agile teams deliver work in small increments. Key practices include daily stand-ups, sprint planning, retrospectives, and continuous integration. Popular frameworks include Scrum and Kanban.",
        "url": "https://example.com/agile",
        "source_type": "web",
        "metadata": {"category": "Software Engineering"}
    }
]

def index_documents():
    """Index all sample documents"""
    print("Starting document indexing...")
    print(f"Total documents to index: {len(sample_documents)}\n")
    
    indexed_count = 0
    failed_count = 0
    
    for i, doc in enumerate(sample_documents, 1):
        try:
            response = requests.post(API_URL, json=doc, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ [{i}/{len(sample_documents)}] Indexed: {doc['title']}")
                print(f"   Document ID: {result.get('document_id')}")
                indexed_count += 1
            else:
                print(f"❌ [{i}/{len(sample_documents)}] Failed: {doc['title']}")
                print(f"   Status: {response.status_code}")
                print(f"   Error: {response.text}")
                failed_count += 1
                
        except requests.exceptions.ConnectionError:
            print(f"❌ Cannot connect to Python API at {API_URL}")
            print("   Make sure the Python API is running: python main.py")
            return
        except Exception as e:
            print(f"❌ [{i}/{len(sample_documents)}] Error indexing {doc['title']}: {str(e)}")
            failed_count += 1
        
        print()  # Empty line for readability
    
    print("=" * 50)
    print(f"Indexing complete!")
    print(f"✅ Successfully indexed: {indexed_count}")
    print(f"❌ Failed: {failed_count}")
    print("=" * 50)

if __name__ == "__main__":
    print("=" * 50)
    print("Verdant Search - Sample Data Indexer")
    print("=" * 50)
    print()
    
    index_documents()
    
    print("\nYou can now search for these documents!")
    print("Try queries like:")
    print("  - 'machine learning'")
    print("  - 'web development'")
    print("  - 'cloud computing'")
    print("  - 'neural networks'")
