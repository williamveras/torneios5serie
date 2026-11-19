import unittest
from unittest.mock import patch
from translation_worker import translate_text


class TranslationTests(unittest.TestCase):
    def test_numeric_omission_retries_with_protected_values(self):
        def model(text, source, target):
            return {"2 jogadores precisam de 32 pontos.": "Players need points.", "jogadores precisam de": "players need", "pontos.": "points."}.get(text, text)
        with patch("argostranslate.translate.translate", side_effect=model):
            self.assertEqual(translate_text("2 jogadores precisam de 32 pontos.", "en"), "2 players need 32 points.")

    def test_urls_emails_line_breaks_are_not_sent_to_model(self):
        with patch("argostranslate.translate.translate", return_value="Contact:") as model:
            result = translate_text("Contato:\nhttps://example.com/32\na@example.com", "en")
            self.assertEqual(result, "Contact:\nhttps://example.com/32\na@example.com")
            self.assertEqual(model.call_count, 1)

    def test_persistent_numeric_corruption_is_rejected(self):
        with patch("argostranslate.translate.translate", return_value="999 points"):
            with self.assertRaisesRegex(ValueError, "Numeric content changed"):
                translate_text("32 pontos", "en")

    def test_portuguese_dos_is_not_the_spanish_number_two(self):
        with patch("argostranslate.translate.translate", return_value="The players' points"):
            self.assertEqual(translate_text("Pontos dos jogadores", "en"), "The players' points")

    def test_equivalent_ordinal_words_and_digits_are_accepted(self):
        with patch("argostranslate.translate.translate", return_value="3rd place gets three points"):
            self.assertEqual(translate_text("Terceiro lugar recebe 3 pontos", "en"), "3rd place gets three points")


if __name__ == "__main__":
    unittest.main()
