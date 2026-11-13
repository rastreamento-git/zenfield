export default function AppFooter({ product = "ZenField", version = "1.1.0" }) {
  return (
    <footer className="page-footer">
      <span className="footer-product">
        {product} · v{version}
      </span>
      <span>
        Desenvolvido por <strong>Victor Rodrigues</strong>
      </span>
    </footer>
  );
}
